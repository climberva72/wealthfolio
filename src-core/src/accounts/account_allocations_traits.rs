use async_trait::async_trait;
use diesel::sqlite::SqliteConnection;

use super::account_allocations_model::{AccountAllocation, NewAccountAllocation};
use crate::Result;

#[async_trait]
pub trait AccountAllocationRepositoryTrait: Send + Sync {
    fn create_in_transaction(
        &self,
        new_alloc: NewAccountAllocation,
        conn: &mut SqliteConnection,
    ) -> Result<AccountAllocation>;

    fn list_for_virtual_account(&self, virtual_account_id: &str) -> Result<Vec<AccountAllocation>>;

    fn list_active_for_virtual_account_on(
        &self,
        virtual_account_id: &str,
        on_date: chrono::NaiveDate,
    ) -> Result<Vec<AccountAllocation>>;

    async fn close_allocation(
        &self,
        allocation_id: &str,
        effective_to: chrono::NaiveDateTime,
    ) -> Result<usize>;

    async fn delete_allocation(&self, allocation_id: &str) -> Result<usize>;

}

#[async_trait]
pub trait AccountAllocationServiceTrait: Send + Sync {
    async fn create_allocation(&self, new_alloc: NewAccountAllocation)
        -> Result<AccountAllocation>;
    fn list_for_virtual_account(&self, virtual_account_id: &str) -> Result<Vec<AccountAllocation>>;
    async fn delete_allocation(&self, allocation_id: &str) -> Result<()>;
    async fn close_allocation(
        &self,
        allocation_id: &str,
        effective_to: chrono::NaiveDateTime,
    ) -> Result<()>;
}
