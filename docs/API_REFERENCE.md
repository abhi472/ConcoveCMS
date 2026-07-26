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

### Inventory Dashboard (Read-Only)

**Endpoint:** `GET /api/v1/inventory/dashboard`

**Query Params:**
- `tenant_id` - UUID of tenant
- `site_id` - Optional internal-site UUID. Omit for the all-sites view.

**Response:**
```json
{
  "generated_at": "2026-07-27T10:30:00Z",
  "data": {
    "summary": {
      "material_count": 42,
      "low_stock_count": 5,
      "critical_stock_count": 2,
      "out_of_stock_count": 1
    },
    "balances": [
      {
        "site_id": "site-uuid",
        "material_id": "material-uuid",
        "quantity_base_uom": 120.5,
        "base_uom_id": "KG",
        "threshold_quantity": 150,
        "status": "LOW",
        "updated_at": "2026-07-27T10:29:00Z"
      }
    ],
    "pending_receipts": [
      {
        "po_id": "po-uuid",
        "po_number": "PO-1042",
        "site_id": "site-uuid",
        "material_id": "material-uuid",
        "ordered_quantity_base_uom": 500,
        "received_quantity_base_uom": 200,
        "expected_delivery_date": "2026-07-30"
      }
    ],
    "recent_movements": [
      {
        "transaction_id": "transaction-uuid",
        "site_id": "site-uuid",
        "material_id": "material-uuid",
        "transaction_type": "INWARD",
        "quantity": 100,
        "recorded_at": "2026-07-27T10:15:00Z"
      }
    ]
  }
}
```

**Key Rules:**
- Balances and status are authoritative backend calculations; the CMS must not reconstruct them from transaction history.
- Status values are `OK`, `LOW`, `CRITICAL`, or `OUT_OF_STOCK`.
- When `site_id` is supplied, every summary count and returned collection must be scoped to that site.
- When `site_id` is omitted, balances include all tenant sites for the heatmap.
- `generated_at` and each balance `updated_at` must be valid ISO 8601 timestamps.

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
