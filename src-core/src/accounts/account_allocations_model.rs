use crate::{errors::ValidationError, Error};
use chrono::Utc;
use diesel::prelude::*;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountAllocation {
    pub id: String,
    pub virtual_account_id: String,
    pub source_account_id: String,
    pub asset_id: String,
    pub allocation_value: String,
    pub effective_from: String,
}

impl AccountAllocation {
    pub fn allocation_value_decimal(&self) -> rust_decimal::Decimal {
        self.allocation_value
            .parse::<rust_decimal::Decimal>()
            .unwrap_or(rust_decimal::Decimal::ZERO)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewAccountAllocation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    pub virtual_account_id: String,
    pub source_account_id: String,
    pub asset_id: String,
    pub allocation_value: Decimal,
    pub effective_from: String,
}

impl NewAccountAllocation {
    pub fn validate(&self) -> crate::Result<()> {
        if self.virtual_account_id.trim().is_empty() {
            return Err(Error::Validation(ValidationError::InvalidInput(
                "Virtual account ID required".to_string(),
            )));
        }
        if self.source_account_id.trim().is_empty() {
            return Err(Error::Validation(ValidationError::InvalidInput(
                "Source account ID required".to_string(),
            )));
        }
        if self.asset_id.trim().is_empty() {
            return Err(Error::Validation(ValidationError::InvalidInput(
                "Asset ID required".to_string(),
            )));
        }
        //if self.allocation_value < 0.0 {
        //    return Err(Error::Validation(ValidationError::InvalidInput(
        //        "Allocation value must be >= 0".to_string(),
        //    )));
        //}
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccountAllocation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub virtual_account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_account_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allocation_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allocation_value: Option<Decimal>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effective_from: Option<String>,
}

impl UpdateAccountAllocation {
    pub fn validate(&self) -> crate::Result<()> {
        if let Some(v) = &self.virtual_account_id {
            if v.trim().is_empty() {
                return Err(Error::Validation(ValidationError::InvalidInput(
                    "Virtual account ID required".to_string(),
                )));
            }
        }
        if let Some(v) = &self.source_account_id {
            if v.trim().is_empty() {
                return Err(Error::Validation(ValidationError::InvalidInput(
                    "Source account ID required".to_string(),
                )));
            }
        }
        if let Some(v) = &self.asset_id {
            if v.trim().is_empty() {
                return Err(Error::Validation(ValidationError::InvalidInput(
                    "Asset ID required".to_string(),
                )));
            }
        }
        if let Some(t) = &self.allocation_type {
            match t.as_str() {
                "percent" | "units" | "value" => {}
                _ => {
                    return Err(Error::Validation(ValidationError::InvalidInput(
                        "Allocation type must be one of: percent, units, value".to_string(),
                    )))
                }
            }
        }
        Ok(())
    }
}

/// Diesel changeset for partial updates (DB shape)
#[derive(Debug, Clone, Default, AsChangeset)]
#[diesel(table_name = crate::schema::account_allocations)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct AccountAllocationChangeset {
    pub virtual_account_id: Option<String>,
    pub source_account_id: Option<String>,
    pub asset_id: Option<String>,
    pub allocation_value: Option<String>,
    pub effective_from: Option<String>,
    // NOTE: we intentionally do NOT include effective_to here due to tri-state handling
}

impl UpdateAccountAllocation {
    /// Convert into a Diesel changeset + a flag for whether to null-out effective_to
    pub fn into_changeset(self) -> (AccountAllocationChangeset) {
        let cs = AccountAllocationChangeset {
            virtual_account_id: self.virtual_account_id,
            source_account_id: self.source_account_id,
            asset_id: self.asset_id,
            allocation_value: self.allocation_value.map(|d| d.to_string()),
            effective_from: self.effective_from,
        };

        cs
    }
}

/// Database model for account allocation
#[derive(
    Queryable,
    Identifiable,
    Insertable,
    AsChangeset,
    Selectable,
    PartialEq,
    Serialize,
    Deserialize,
    Debug,
    Clone,
)]
#[diesel(table_name = crate::schema::account_allocations)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct AccountAllocationDB {
    pub id: String,
    pub virtual_account_id: String,
    pub source_account_id: String,
    pub asset_id: String,
    pub allocation_value: String,
    pub effective_from: String,
}

impl From<AccountAllocationDB> for AccountAllocation {
    fn from(db: AccountAllocationDB) -> Self {
        Self {
            id: db.id,
            virtual_account_id: db.virtual_account_id,
            source_account_id: db.source_account_id,
            asset_id: db.asset_id,
            allocation_value: db.allocation_value,
            effective_from: db.effective_from
        }
    }
}

impl From<NewAccountAllocation> for AccountAllocationDB {
    fn from(domain: NewAccountAllocation) -> Self {
        let now = Utc::now();
        Self {
            id: domain.id.unwrap_or_default(),
            virtual_account_id: domain.virtual_account_id,
            source_account_id: domain.source_account_id,
            asset_id: domain.asset_id,
            allocation_value: domain.allocation_value.to_string(),
            effective_from: domain.effective_from,
        }
    }
}
