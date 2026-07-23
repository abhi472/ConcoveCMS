# API Reference

## Backend Contract Overview

All API calls are prefixed with `/api/v1` and require:
- `tenant_id` query parameter (GET) or in request body (POST)  
- `X-Tenant-ID` header (automatically added by axios interceptor)

### Master Data (Read-Only)

**Endpoint:** `GET /api/v1/sync/master-data`

**Query Params:**
- `tenant_id` - UUID of tenant

**Response:** `{ data: { materials, entities, purchase_orders } }`

- `materials`: Material catalog with `material_code` (kebab-case), `base_uom_id`, `issue_uom_id`, `conversion_factor`
- `entities`: Polymorphic actors (VENDOR, INTERNAL_SITE, SUBCONTRACTOR, EMPLOYEE)
- `purchase_orders`: Draft/approved procurement contracts with line items

### Transaction Batch (Write)

**Endpoint:** `POST /api/v1/sync/transactions/batch`

**Request Body:** Array of `InventoryTransaction` objects

**Response:** HTTP 207 Multi-Status with per-record outcomes:
```json
{
  "status": 207,
  "results": [
    { "client_transaction_id": "uuid-1", "success": true },
    { "client_transaction_id": "uuid-2", "success": false, "error": "Tenant mismatch" }
  ]
}
```

**Key Rules:**
- `client_transaction_id` must be unique (used for idempotency)
- All entities (`site_id`, `source_entity_id`, `destination_entity_id`, `po_id`) must belong to same tenant
- Optional `correction_of_transaction_id` references parent transaction for immutable ledger corrections
- Transaction types: INWARD, OUTWARD, IST_DISPATCH, IST_RECEIPT

### Fluid Dispense (Rapid Write)

**Endpoint:** `POST /api/v1/inventory/fluid-dispense`

**Request Body:** Fluid-specific transaction with `site_id` and `vehicle_id`

**Response:** HTTP 207 Multi-Status (same structure as batch)

---

## Error Handling

### HTTP 400: Validation Error
```json
{
  "status": 400,
  "message": "Validation failed",
  "errors": [{ "field": "quantity", "message": "Must be > 0" }]
}
```

### HTTP 207: Partial Success
Individual records in the batch may succeed or fail. Check `results` array for per-record status.

**Common error reasons:**
- `Tenant mismatch` - Entity does not belong to tenant_id
- `Invalid material_id` - Material not in tenant's catalog
- `Quantity validation` - Quantity must be numeric and > 0

---

## Frontend Implementation Notes

- Use `masterDataQueryKey(tenantId)` for React Query cache keys
- Persist failed 207 records in `SyncRetryContext` for retry workflows
- Store successful transactions in sync history for correction draft creation
- Display tenant-mismatch errors to operator immediately
