use std::sync::Arc;

use crate::{
    context::ServiceContext,
    events::{emit_resource_changed, ResourceEventPayload},
};
use log::{debug, error};
use tauri::{State};
use serde_json::json;
use wealthfolio_core::accounts::{AccountAllocation, NewAccountAllocation};

#[tauri::command]
pub async fn create_account_allocation(
    allocation: NewAccountAllocation,
    state: State<'_, Arc<ServiceContext>>,
    handle: tauri::AppHandle,
) -> Result<AccountAllocation, String> {
    debug!("Adding new account allocation...");
    let result = state
        .account_allocation_service()
        .create_allocation(allocation)
        .await;

    match result {
        Ok(acc) => {
            emit_resource_changed(
                &handle,
                ResourceEventPayload::new(
                    "account",
                    "created",
                    json!({
                        "account_id": acc.id,
                    }),
                ),
            );
            Ok(acc)
        }
        Err(e) => {
            error!("Failed to add new account allocation: {}", e); // Use error! for errors
            Err(format!("Failed to add new account allocation: {}", e))
        }
    }
}

#[tauri::command]
pub async fn list_account_allocations(
    virtual_account_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<Vec<AccountAllocation>, String> {
    debug!("Listing allocations for virtual_account_id={}", virtual_account_id);

    state
        .account_allocation_service()
        .list_for_virtual_account(&virtual_account_id)
        .map_err(|e| {
            error!("Failed to list allocations: {}", e);
            format!("Failed to list allocations: {}", e)
        })
}

#[tauri::command]
pub async fn delete_account_allocation(
    allocation_id: String,
    state: State<'_, Arc<ServiceContext>>,
) -> Result<(), String> {
    log::debug!("Deleting allocation {}", allocation_id);

    state
        .account_allocation_service()
        .delete_allocation(&allocation_id)
        .await
        .map_err(|e| format!("Failed to delete allocation: {}", e))
}
