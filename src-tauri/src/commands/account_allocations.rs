use std::sync::Arc;

use crate::{
    context::ServiceContext,
    events::{emit_resource_changed, ResourceEventPayload},
};
use log::{debug, error};
use tauri::{State};
use serde_json::json;
use wealthfolio_core::accounts::{AccountAllocation, NewAccountAllocation, UpdateAccountAllocation};

async fn recalc_virtual_and_emit(
    state: &Arc<ServiceContext>,
    handle: &tauri::AppHandle,
    virtual_account_id: &str,
) -> Result<(), String> {
    state
        .snapshot_service()
        .recalculate_virtual_account(virtual_account_id)
        .await
        .map_err(|e| format!("Failed to recalc virtual snapshots: {}", e))?;

    emit_resource_changed(
        handle,
        ResourceEventPayload::new(
            "virtual_account",
            "snapshots_updated",
            serde_json::json!({ "account_id": virtual_account_id }),
        ),
    );

    Ok(())
}

#[tauri::command]
pub async fn create_account_allocation(
    allocation: NewAccountAllocation,
    state: State<'_, Arc<ServiceContext>>,
    handle: tauri::AppHandle,
) -> Result<AccountAllocation, String> {
    debug!("Adding new account allocation...");

    let virtual_account_id = allocation.virtual_account_id.clone();

    let result = state
        .account_allocation_service()
        .create_allocation(allocation)
        .await;

    match result {
        Ok(acc) => {
            // ✅ recompute virtual snapshots immediately
            recalc_virtual_and_emit(&state, &handle, &virtual_account_id).await?;

            emit_resource_changed(
                &handle,
                ResourceEventPayload::new(
                    "account",
                    "created",
                    json!({ "account_id": acc.id }),
                ),
            );
            Ok(acc)
        }
        Err(e) => {
            error!("Failed to add new account allocation: {}", e);
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
pub async fn update_account_allocation(
    allocation_id: String,
    changes: UpdateAccountAllocation,
    state: State<'_, Arc<ServiceContext>>,
    handle: tauri::AppHandle,
) -> Result<AccountAllocation, String> {
    debug!("Updating allocation allocation_id={}", allocation_id);

    let result = state
        .account_allocation_service()
        .update_allocation(&allocation_id, changes)
        .await;

    match result {
        Ok(acc) => {
            // ✅ recompute
            recalc_virtual_and_emit(&state, &handle, &acc.virtual_account_id).await?;

            emit_resource_changed(
                &handle,
                ResourceEventPayload::new(
                    "account",
                    "updated",
                    json!({ "account_id": acc.id }),
                ),
            );
            Ok(acc)
        }
        Err(e) => {
            error!("Failed to update allocation: {}", e);
            Err(format!("Failed to update allocation: {}", e))
        }
    }
}

#[tauri::command]
pub async fn delete_account_allocation(
    allocation_id: String,
    state: State<'_, Arc<ServiceContext>>,
    handle: tauri::AppHandle,
) -> Result<(), String> {
    let deleted = state
        .account_allocation_service()
        .delete_allocation(&allocation_id)
        .await
        .map_err(|e| format!("Failed to delete allocation: {}", e))?;

    recalc_virtual_and_emit(&state, &handle, &deleted.virtual_account_id).await?;
    Ok(())
}

