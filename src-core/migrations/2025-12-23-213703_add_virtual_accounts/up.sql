
ALTER TABLE accounts
ADD COLUMN is_virtual BOOLEAN NOT NULL DEFAULT 0;

CREATE TABLE account_allocations (
    id TEXT PRIMARY KEY NOT NULL,
    virtual_account_id TEXT NOT NULL,
    source_account_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    allocation_type TEXT NOT NULL CHECK (allocation_type IN ('percent','units','value')),
    allocation_value TEXT NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to   TEXT,
    created_at TEXT NOT NULL,

    FOREIGN KEY (virtual_account_id)
      REFERENCES accounts(id)
      ON DELETE CASCADE,

    FOREIGN KEY (source_account_id)
      REFERENCES accounts(id)
);
