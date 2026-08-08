# API Reference

## Backend Contract Overview

All API calls are prefixed with `/api/v1` and require:
- `tenant_id` query parameter (GET) or in request body (POST)  
- `X-Tenant-ID` header (automatically added by axios interceptor)

Release note (2026-08-07): FEAT-009 frontend analytics integration is complete in source. If `/api/v1/analytics/overview` returns `404`, deploy the latest backend revision that includes analytics route/controller wiring.

### Master Data (Read-Only)

**Endpoint:** `GET /api/v1/sync/master-data`

**Query Params:**
- `tenant_id` - UUID of tenant

**Response:** `{ data: { materials, entities, purchase_orders } }`

- `materials`: Material catalog with `material_code` (kebab-case), `base_uom_id`, `issue_uom_id`, `conversion_factor`
- `entities`: Polymorphic actors (VENDOR, INTERNAL_SITE, SUBCONTRACTOR, EMPLOYEE)
- `purchase_orders`: Draft/approved procurement contracts with line items

This endpoint remains a bootstrap compatibility contract. Operational catalog screens use the resource-specific APIs below. Archived materials and entities are excluded from bootstrap results.

### Materials Catalog

**Endpoints:**
- `GET /api/v1/materials?tenant_id&search&status&base_uom_id&sort&direction&page&page_size`
- `POST /api/v1/materials`
- `POST /api/v1/materials/csv`
- `GET /api/v1/materials/{material_id}?tenant_id`
- `PATCH /api/v1/materials/{material_id}`
- `POST /api/v1/materials/{material_id}/archive`
- `POST /api/v1/materials/{material_id}/restore`

Material codes are normalized server-side to lowercase kebab-case and are unique within a tenant. Archive is blocked with HTTP 409 while active site assignments or open purchase-order lines exist. Historical ledger references never block archive and remain intact.

### Entities Catalog

**Endpoints:**
- `GET /api/v1/entities?tenant_id&search&entity_type&status&site_id&page&page_size`
- `POST /api/v1/entities`
- `POST /api/v1/entities/csv`
- `GET /api/v1/entities/{entity_id}?tenant_id`
- `PATCH /api/v1/entities/{entity_id}`
- `POST /api/v1/entities/{entity_id}/archive`
- `POST /api/v1/entities/{entity_id}/restore`
- `GET /api/v1/entities/{entity_id}/sites?tenant_id`
- `PUT /api/v1/entities/{entity_id}/sites/{site_id}`
- `DELETE /api/v1/entities/{entity_id}/sites/{site_id}?tenant_id`

Profile fields are validated by entity type. Employees and subcontractors use `ASSIGNED` site relationships and may have one primary site. Vendors use non-restrictive `PREFERRED` relationships. Site archive is blocked by non-zero stock, open target POs, or active associations; vendor archive is blocked by open POs; employee/subcontractor archive is blocked by active site associations.

When `site_id` is supplied, employees and subcontractors are restricted to active assignments for that site. Vendors remain tenant-wide, with preferred vendors ordered first.

### Site-Material Assignments

**Endpoints:**
- `GET /api/v1/inventory/site-materials?tenant_id&site_id`
- `POST /api/v1/inventory/site-materials/bulk`
- `PUT /api/v1/inventory/sites/{site_id}/materials/{material_id}`
- `DELETE /api/v1/inventory/sites/{site_id}/materials/{material_id}?tenant_id`

Bulk requests accept 1-200 `ASSIGN` or `UNASSIGN` items and apply atomically. Unassignment is lifecycle-based and returns structured HTTP 409 blockers for non-zero stock or open purchase orders. New transaction writes require an active assignment.

### Purchase Orders

**Endpoints:**
- `GET /api/v1/purchase-orders?tenant_id&search&status&site_id&vendor_id&material_id&page&page_size`
- `POST /api/v1/purchase-orders`
- `GET /api/v1/purchase-orders/{purchase_order_id}?tenant_id`
- `PATCH /api/v1/purchase-orders/{purchase_order_id}`
- `PATCH /api/v1/purchase-orders/{purchase_order_id}/status`

Creation atomically persists a DRAFT purchase order and its line items. `client_request_id` provides durable replay idempotency independently of PO-number uniqueness. DRAFT headers and lines may be replaced atomically with `PATCH`; non-DRAFT edits return `PO_NOT_EDITABLE`. The vendor and target site must be active entities in the tenant, every material must be active and assigned to the target site, quantities must be positive, rates must be non-negative, and a material may appear only once per order.

List responses include `line_count`, `ordered_quantity_base_uom`, `received_quantity_base_uom`, and `open_quantity_base_uom`. Detail responses include received and open quantities per line. These values are calculated from immutable INWARD ledger entries rather than stored counters.

Status changes are forward-only:
- `DRAFT` -> `APPROVED`
- `APPROVED` -> `PARTIALLY_FULFILLED` or `COMPLETED`
- `PARTIALLY_FULFILLED` -> `COMPLETED`

Repeated writes of the current status are accepted. Backward transitions return HTTP 409 with code `INVALID_PO_STATUS_TRANSITION`.

PO-linked INWARD transactions lock the order while validating that it is APPROVED or PARTIALLY_FULFILLED, targets the transaction site, contains the material, uses the PO vendor as source, and has enough open quantity. A successful receipt automatically derives PARTIALLY_FULFILLED or COMPLETED status in the same database transaction. General INWARD entries may omit `po_id`.

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
    "sites": [
      { "id": "site-uuid", "name": "Site A1" }
    ],
    "entity_counts": [
      { "entity_type": "INTERNAL_SITE", "entity_count": 4 },
      { "entity_type": "VENDOR", "entity_count": 12 },
      { "entity_type": "EMPLOYEE", "entity_count": 18 },
      { "entity_type": "SUBCONTRACTOR", "entity_count": 3 }
    ],
    "site_summaries": [
      {
        "site_id": "site-uuid",
        "site_name": "Site A1",
        "material_count": 12,
        "low_stock_count": 1,
        "critical_stock_count": 1,
        "out_of_stock_count": 0
      }
    ],
    "priority_risks": [
      {
        "site_id": "site-uuid",
        "site_name": "Site A1",
        "material_id": "material-uuid",
        "material_code": "cement",
        "material_description": "Cement",
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
        "site_name": "Site A1",
        "material_id": "material-uuid",
        "material_code": "cement",
        "ordered_quantity_base_uom": 500,
        "received_quantity_base_uom": 200,
        "expected_delivery_date": "2026-07-30"
      }
    ],
    "recent_movements": [
      {
        "transaction_id": "transaction-uuid",
        "site_id": "site-uuid",
        "site_name": "Site A1",
        "material_id": "material-uuid",
        "material_code": "cement",
        "transaction_type": "INWARD",
        "quantity": 100,
        "recorded_at": "2026-07-27T10:15:00Z"
      }
    ]
  }
}
```

**Key Rules:**
- Summary counts and priority rows are authoritative backend calculations; the CMS must not reconstruct them from transaction history.
- Status values are `OK`, `LOW`, `CRITICAL`, or `OUT_OF_STOCK`.
- When `site_id` is supplied, every summary count and returned collection must be scoped to that site.
- When `site_id` is omitted, overview rows include all tenant sites for the landing view.
- `generated_at` and each priority-risk `updated_at` must be valid ISO 8601 timestamps.

### Inventory Balances

**Endpoint:** `GET /api/v1/inventory/balances?tenant_id&site_id&material_id`

Returns authoritative active-assignment balances, base UOM, thresholds, and `OK|LOW|CRITICAL|OUT_OF_STOCK` status. `site_id` and `material_id` are optional filters. Operations uses this endpoint for advisory inline guidance; outbound writes remain protected by a transaction-scoped backend stock check.

### Transaction Batch (Write)

**Endpoint:** `POST /api/v1/sync/transactions/batch`

**CSV Variant:** `POST /api/v1/sync/transactions/csv`

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
- Sites, materials, source entities, and destination entities must be active.
- The material must be actively assigned to the transaction site.
- Employees and subcontractors referenced by normal writes must be actively assigned to the site. Corrections retain historical-reference exceptions.
- OUTWARD and IST_DISPATCH writes lock the site/material policy and reject quantities above the current balance.
- When `po_id` is supplied, the transaction must be an INWARD receipt matching the PO site, vendor, material line, lifecycle status, and remaining open quantity.

### Fluid Dispense (Rapid Write)

**Endpoint:** `POST /api/v1/inventory/fluid-dispense`

**Request Body:** Fluid-specific transaction with `site_id` and `vehicle_id`

**Response:** HTTP 207 Multi-Status (same structure as batch)

### Analytics Overview

**Endpoint:** `GET /api/v1/analytics/overview?tenant_id&site_id&days`

**Role Access:** `ADMIN`, `SITE_MANAGER`, `OPERATOR`, `VIEWER`

**Response Shape:**
```json
{
  "generated_at": "2026-08-07T11:15:00Z",
  "data": {
    "range_days": 30,
    "summary": {
      "seven_day_inward_units": 3225,
      "seven_day_outward_units": 2455,
      "fulfillment_ratio_percent": 82.3,
      "projected_spend_month": 4280000
    },
    "material_usage": [],
    "po_allocation": []
  }
}
```

### Transaction History

**Endpoints:**
- `GET /api/v1/transactions?tenant_id&search&site_id&material_id&transaction_type&date_from&date_to&page&page_size`
- `GET /api/v1/transactions/{transaction_id}?tenant_id`

The list is the server-authoritative history of successful immutable ledger rows. It returns tenant-scoped site/material names, base UOM, PO references, source/destination names, transaction time, server-recorded time, durable `correction_of_transaction_id` and `correction_reason`, and pagination metadata. Detail responses also include commercial and volumetric extensions.

Failed HTTP 207 rows are not persisted because no ledger transaction was created. The CMS retains only those failed/unsent payloads locally for recovery. Successful records and correction lineage are server-authoritative.

### Master Data Audit

**Endpoint:** `GET /api/v1/audit-events?tenant_id&resource_type&resource_id&action&page&page_size`

V7 database triggers write immutable CREATE, UPDATE, ARCHIVE, RESTORE, ASSIGN, and UNASSIGN events in the same transaction as material, entity, site-material, and entity-site mutations. The actor defaults to trusted `cms-service`; arbitrary browser display names are not accepted.

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

- Use resource-specific `materialsQueryKey`, `entitiesQueryKey`, `entitySitesQueryKey`, `siteMaterialsQueryKey`, `purchaseOrdersQueryKey`, and `transactionsQueryKey` keys for managed resources. Retain `masterDataQueryKey` for bootstrap consumers.
- Persist failed 207 records in `SyncRetryContext` for retry workflows
- Read successful transactions and correction lineage from the server; local storage is limited to failed/unsent recovery and procurement draft recovery
- Display tenant-mismatch errors to operator immediately

## Deployment Order

For this release, apply migrations before deploying the matching backend:

1. `V6__transaction_correction_lineage.sql`
2. `V7__master_data_audit_triggers.sql`
3. `V8__purchase_order_idempotency.sql`
4. Backend API deployment
5. CMS deployment

Run V6-V8 against a non-production PostgreSQL database first. pg-mem validates controller behavior but does not execute PostgreSQL trigger migrations.
