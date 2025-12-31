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
    AccountAllocation, AccountAllocationDB, NewAccountAllocation, UpdateAccountAllocation
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
            .order(effective_from.asc())
            .load::<AccountAllocationDB>(&mut conn)?;

        Ok(rows.into_iter().map(AccountAllocation::from).collect())
    }

    fn get_by_id(&self, allocation_id_param: &str) -> Result<AccountAllocation> {
        let mut conn = get_connection(&self.pool)?;

        let row = account_allocations::table
            .filter(account_allocations::id.eq(allocation_id_param))
            .select(AccountAllocationDB::as_select())
            .first::<AccountAllocationDB>(&mut conn)?;

        Ok(AccountAllocation::from(row))
    }

    fn list_active_for_virtual_account_on(
        &self,
        virtual_account_id_param: &str,
        on_date: chrono::NaiveDate,
    ) -> Result<Vec<AccountAllocation>> {
        let mut conn = get_connection(&self.pool)?;

        use crate::schema::account_allocations::dsl as aa;

        // As-of end-of-day (exclusive): effective_from < end_of_day
        let end_dt = on_date
            .succ_opt()
            .unwrap_or(on_date)
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();

        let end_str = end_dt.to_rfc3339();

        // Load all allocations effective before end_of_day, newest first per asset
        let rows = aa::account_allocations
            .filter(aa::virtual_account_id.eq(virtual_account_id_param))
            .filter(aa::effective_from.lt(&end_str))
            .select(AccountAllocationDB::as_select())
            .order((aa::asset_id.asc(), aa::effective_from.desc()))
            .load::<AccountAllocationDB>(&mut conn)?;

        // Keep only the latest allocation per asset_id (effective until changed)
        let mut latest_by_asset: std::collections::HashMap<String, AccountAllocationDB> =
            std::collections::HashMap::new();

        for r in rows {
            latest_by_asset.entry(r.asset_id.clone()).or_insert(r);
        }

        // Deterministic output order
        let mut out: Vec<AccountAllocation> = latest_by_asset
            .into_values()
            .map(AccountAllocation::from)
            .collect();

        out.sort_by(|a, b| a.asset_id.cmp(&b.asset_id));
        Ok(out)
    }


    fn update_allocation(
        &self,
        allocation_id_param: &str,
        changes: UpdateAccountAllocation,
    ) -> Result<AccountAllocation> {
        changes.validate()?;

        let (cs) = changes.into_changeset();

        let mut conn = get_connection(&self.pool)?;

        // apply normal field updates (only Some(_) fields get updated)
        diesel::update(account_allocations.filter(id.eq(allocation_id_param)))
            .set(cs)
            .execute(&mut conn)?;

        // return updated row
        let updated_db = account_allocations
            .filter(id.eq(allocation_id_param))
            .select(AccountAllocationDB::as_select())
            .first::<AccountAllocationDB>(&mut conn)?;

        Ok(updated_db.into())
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
