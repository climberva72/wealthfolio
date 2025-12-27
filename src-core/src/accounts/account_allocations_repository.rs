use async_trait::async_trait;
use diesel::prelude::*;
use diesel::r2d2::{self, Pool};
use diesel::sqlite::SqliteConnection;
use std::sync::Arc;

use crate::db::{get_connection, WriteHandle};
use crate::errors::Result;
use crate::schema::account_allocations;
use crate::schema::account_allocations::dsl::*;

use super::account_allocations_model::{
    AccountAllocation, AccountAllocationDB, NewAccountAllocation,
};
use super::account_allocations_traits::AccountAllocationRepositoryTrait;

/// Repository for managing account allocation rules in the database
pub struct AccountAllocationRepository {
    pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
    writer: WriteHandle,
}

impl AccountAllocationRepository {
    pub fn new(
        pool: Arc<Pool<r2d2::ConnectionManager<SqliteConnection>>>,
        writer: WriteHandle,
    ) -> Self {
        Self { pool, writer }
    }
}

#[async_trait]
impl AccountAllocationRepositoryTrait for AccountAllocationRepository {
    fn create_in_transaction(
        &self,
        new_alloc: NewAccountAllocation,
        conn: &mut SqliteConnection,
    ) -> Result<AccountAllocation> {
        new_alloc.validate()?;

        use crate::schema::account_allocations::dsl as aa;

        // Close any currently-active allocation for the same virtual+source+asset
        diesel::update(
            aa::account_allocations
                .filter(aa::virtual_account_id.eq(&new_alloc.virtual_account_id))
                .filter(aa::asset_id.eq(&new_alloc.asset_id))
                .filter(aa::effective_to.is_null()),
        )
        .set(aa::effective_to.eq(&new_alloc.effective_from))
        .execute(conn)?;


        // Insert new allocation
        let mut alloc_db: AccountAllocationDB = new_alloc.into();
        alloc_db.id = uuid::Uuid::new_v4().to_string();

        diesel::insert_into(aa::account_allocations)
            .values(&alloc_db)
            .execute(conn)?;

        Ok(alloc_db.into())
    }


    fn list_for_virtual_account(
        &self,
        virtual_account_id_param: &str,
    ) -> Result<Vec<AccountAllocation>> {
        let mut conn = get_connection(&self.pool)?;

        let rows = account_allocations::table
            .filter(virtual_account_id.eq(virtual_account_id_param))
            .select(AccountAllocationDB::as_select())
            .order((effective_from.asc(), created_at.asc()))
            .load::<AccountAllocationDB>(&mut conn)?;

        Ok(rows.into_iter().map(AccountAllocation::from).collect())
    }

    fn list_active_for_virtual_account_on(
        &self,
        virtual_account_id_param: &str,
        on_date: chrono::NaiveDate,
    ) -> Result<Vec<AccountAllocation>> {
        let mut conn = get_connection(&self.pool)?;

        use crate::schema::account_allocations::dsl as aa;

        // Build a UTC day window [start, end)
        let start_dt = on_date.and_hms_opt(0, 0, 0).unwrap().and_utc();
        let end_dt = on_date
            .succ_opt()
            .unwrap_or(on_date)
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();

        let start_str = start_dt.to_rfc3339();
        let end_str = end_dt.to_rfc3339();

        // Active if:
        // effective_from < end_of_day AND (effective_to is null OR effective_to > start_of_day)
        let rows = aa::account_allocations
            .filter(aa::virtual_account_id.eq(virtual_account_id_param))
            .filter(aa::effective_from.lt(&end_str))
            .filter(aa::effective_to.is_null().or(aa::effective_to.gt(&start_str)))
            .select(AccountAllocationDB::as_select())
            // newest allocation wins if overlaps exist (defensive)
            .order((aa::asset_id.asc(), aa::effective_from.desc(), aa::created_at.desc()))
            .load::<AccountAllocationDB>(&mut conn)?;

        Ok(rows.into_iter().map(AccountAllocation::from).collect())
    }

    async fn close_allocation(
        &self,
        allocation_id_param: &str,
        effective_to_param: chrono::NaiveDateTime,
    ) -> Result<usize> {
        let alloc_id = allocation_id_param.to_string();
        let effective_to_str = effective_to_param.and_utc().to_rfc3339();

        // We only set effective_to; we do NOT mutate other fields.
        self.writer
            .exec(move |conn| {
                let affected = diesel::update(account_allocations.find(&alloc_id))
                    .set(effective_to.eq(effective_to_str))
                    .execute(conn)?;

                Ok(affected)
            })
            .await
    }

    async fn delete_allocation(&self, allocation_id_param: &str) -> Result<usize> {
        let alloc_id = allocation_id_param.to_string();

        self.writer
            .exec(move |conn| {
                let affected = diesel::delete(account_allocations.find(&alloc_id)).execute(conn)?;
                Ok(affected)
            })
            .await
    }
}
