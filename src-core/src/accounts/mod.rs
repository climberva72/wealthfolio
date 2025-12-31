// Module declarations
pub(crate) mod accounts_constants;
pub(crate) mod accounts_model;
pub(crate) mod accounts_repository;
pub(crate) mod accounts_service;
pub(crate) mod accounts_traits;

pub(crate) mod account_allocations_model;
pub(crate) mod account_allocations_repository;
pub(crate) mod account_allocations_service;
pub(crate) mod account_allocations_traits;

// Re-export the public interface
pub use accounts_constants::*;
// pub use accounts_errors::*;
pub use accounts_model::{Account, AccountDB, AccountUpdate, NewAccount};
pub use accounts_repository::AccountRepository;
pub use accounts_service::AccountService;
pub use accounts_traits::{AccountRepositoryTrait, AccountServiceTrait};

pub use account_allocations_model::{AccountAllocation, AccountAllocationDB, NewAccountAllocation, UpdateAccountAllocation};
pub use account_allocations_repository::AccountAllocationRepository;
pub use account_allocations_service::AccountAllocationService;
pub use account_allocations_traits::{AccountAllocationRepositoryTrait, AccountAllocationServiceTrait};
