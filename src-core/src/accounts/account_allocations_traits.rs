use async_trait::async_trait;
use diesel::sqlite::SqliteConnection;

use super::account_allocations_model::{AccountAllocation, NewAccountAllocation, UpdateAccountAllocation};
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

    fn update_allocation(
        &self,
        allocation_id: &str,
        changes: UpdateAccountAllocation,
    ) -> Result<AccountAllocation>;

    async fn delete_allocation(&self, allocation_id: &str) -> Result<usize>;

    fn get_by_id(&self, allocation_id: &str) -> Result<AccountAllocation>;

}

#[async_trait]
pub trait AccountAllocationServiceTrait: Send + Sync {
    async fn create_allocation(&self, new_alloc: NewAccountAllocation)
        -> Result<AccountAllocation>;
    fn list_for_virtual_account(&self, virtual_account_id: &str) -> Result<Vec<AccountAllocation>>;
    async fn delete_allocation(&self, allocation_id: &str) -> Result<AccountAllocation>;
    async fn update_allocation(
        &self,
        allocation_id: &str,
        changes: UpdateAccountAllocation,
    ) -> Result<AccountAllocation>;
}
