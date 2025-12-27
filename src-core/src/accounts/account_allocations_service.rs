use std::sync::{Arc, RwLock};

use super::account_allocations_model::{AccountAllocation, NewAccountAllocation};
use super::account_allocations_traits::{AccountAllocationRepositoryTrait, AccountAllocationServiceTrait};
use crate::db::DbTransactionExecutor;
use crate::errors::Result;
use crate::fx::fx_traits::FxServiceTrait;

/// Service for managing account allocations (Generic over Executor)
pub struct AccountAllocationService<E: DbTransactionExecutor + Send + Sync + Clone> {
    repository: Arc<dyn AccountAllocationRepositoryTrait>,
    fx_service: Arc<dyn FxServiceTrait>,
    base_currency: Arc<RwLock<String>>,
    transaction_executor: E,
}

impl<E: DbTransactionExecutor + Send + Sync + Clone> AccountAllocationService<E> {
    /// Creates a new AccountService instance
    pub fn new(
        repository: Arc<dyn AccountAllocationRepositoryTrait>,
        fx_service: Arc<dyn FxServiceTrait>,
        transaction_executor: E,
        base_currency: Arc<RwLock<String>>,
    ) -> Self {
        Self {
            repository,
            fx_service,
            transaction_executor,
            base_currency,
        }
    }
}

#[async_trait::async_trait]
impl<E: DbTransactionExecutor + Send + Sync + Clone> AccountAllocationServiceTrait for AccountAllocationService<E> {
    /// Creates a new allocation
    async fn create_allocation(&self, new_account_allocation: NewAccountAllocation) -> Result<AccountAllocation> {

        // Clones for the transaction closure
        let repository_for_tx = self.repository.clone();
        let new_account_allocation_for_tx = new_account_allocation.clone();
        let executor_for_tx = self.transaction_executor.clone();

        executor_for_tx.execute(move |tx_conn| {
            // The currency pair registration logic has been moved outside this closure
            repository_for_tx.create_in_transaction(new_account_allocation_for_tx, tx_conn)
        })

    }

    fn list_for_virtual_account(&self, virtual_account_id: &str) -> Result<Vec<AccountAllocation>> {
        (*self.repository).list_for_virtual_account(virtual_account_id)
    }

    async fn delete_allocation(&self, allocation_id: &str) -> Result<()> {
        (*self.repository).delete_allocation(allocation_id).await?;
        Ok(())
    }

    async fn close_allocation(
        &self,
        allocation_id: &str,
        effective_to: chrono::NaiveDateTime,
    ) -> Result<()> {
        (*self.repository).close_allocation(allocation_id, effective_to).await?;
        Ok(())
    }

}
