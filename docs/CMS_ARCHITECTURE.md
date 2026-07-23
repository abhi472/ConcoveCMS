# Web CMS Architecture

## 1. Purpose
The CMS is the online-first administrative control layer for Project Badri Rai.

It is designed to:
- Read live tenant-scoped master data from the backend.
- Provide an operations workspace for procurement and ledger-oriented workflows.
- Surface partial sync outcomes (HTTP 207) in an operator-friendly way.

## 2. Core Stack
- Framework: React + TypeScript (Vite)
- Styling: Tailwind CSS
- Routing: react-router-dom
- Data fetching and cache: @tanstack/react-query
- HTTP client: axios (with centralized interceptors)

## 3. Tenant-Scoped Architecture

### 3.1 Tenant source of truth
Tenant identity is managed through a shared tenant module and context provider.

- Default tenant config comes from environment variables:
  - VITE_TENANT_ID
  - VITE_TENANT_NAME
- Runtime tenant selection is handled by TenantContext.

### 3.2 Tenant propagation
Tenant scope flows through all layers:

1. UI context (selected tenant in header/sidebar)
2. React Query keys (tenant-aware query key segments)
3. Service layer query params (`tenant_id` on master-data reads)
4. Axios request interceptor header (`X-Tenant-ID`)

This prevents cross-tenant context bleed and enforces backend contract alignment.

### 3.3 Tenant-switch cache behavior
On tenant change, the app performs:

1. cancel active tenant-scoped queries
2. remove tenant-scoped caches
3. invalidate and refetch for the new tenant

## 4. API Integration Layer

### 4.1 Axios client
Centralized axios client configuration includes:
- base URL from environment (`VITE_API_BASE_URL`, fallback to localhost)
- base URL from environment (`VITE_API_BASE_URL`, fallback to `/api/v1`)
- request interceptor that appends `X-Tenant-ID`

### 4.2 Read services
Master data service:
- endpoint: GET `/sync/master-data`
- required query param: `tenant_id`
- optional query param: `last_synced_at`

### 4.3 Sync/write services
Transactions service currently includes:
- POST `/sync/transactions/batch`
- POST `/inventory/fluid-dispense`

Typed request/response contracts are used for multi-status payload parsing.

The ledger write UI also supports an immutable correction workflow:
- original successful records are captured in client-side sync history
- correction actions generate a new compensating transaction instead of editing the original row
- failed records are stored separately for retry-oriented operator workflows

## 5. Domain Type System
Shared schema contracts are centralized in `src/types/schema.ts`.

Includes strong typing for:
- UOM
- EntityType
- POStatus
- TransactionType
- Material
- Entity
- POItem
- PurchaseOrder
- InventoryTransaction

This keeps forms and service payloads aligned with backend schema boundaries.

## 6. React Query Strategy

### 6.1 Query keys
Tenant-aware keys are mandatory for tenant-scoped data.

Pattern:
- master-data key includes tenant ID and optional sync watermark

### 6.2 Error handling
Standardized API error utility handles:
- 400 contract validation errors (example: missing/invalid tenant_id)
- 207 multi-status responses with per-record failure extraction

## 7. UI Composition

### 7.1 Layout shell
Persistent app shell contains:
- sidebar navigation
- active tenant visibility
- tenant selector control

### 7.2 Main routes
- `/` Dashboard: tenant-filtered site selection and inventory placeholder view
- `/materials` Material Catalog + material draft panel
- `/operations` Operations Control Workspace
- `/entities` Tenant-grouped entity workspace
- `/sync-monitor` Failed retry queue and immutable correction trail

## 8. Operations Control Workspace
The operations page is structured into three modes:

1. Procurement Superset
	- purchase order draft creation
	- dynamic line-item (`po_items`) drafting
	- status update staging for active orders

2. Ledger Adjustment
	- transaction form with strict quantity validation (`quantity > 0`)
	- auto-generated `client_transaction_id` using `crypto.randomUUID()`
	- optional commercial detail block
	- optional volumetric detail block
	- correction draft mode that creates a compensating entry linked to the original transaction

3. Sync Status Inspector
	- renders per-record SUCCESS/FAILED results from 207 envelopes
	- includes tenant-mismatch operator guidance
	- provides inline `Fix & Retry` actions for failed records
	- provides inline `Correction` actions for successful immutable records
 	- captures correction reasons for compensating entries

## 9. Sync Monitor Workflow
The dedicated Sync Monitor route separates two operational concerns:

1. Failed retry queue
	- shows tenant-filtered failed records from batch sync responses
	- persists failed records in browser localStorage
	- reopens the Operations ledger form with the failed payload prefilled
	- classifies failures into tenant mismatch, validation, or generic sync failure badges
	- exposes recorded timestamps, local search, and tenant-scoped cache clearing

2. Immutable correction trail
	- shows tenant-filtered successful ledger writes captured from sync history
	- allows operators to launch a compensating correction draft
	- preserves original ledger immutability by issuing a new transaction rather than editing history
	- groups parent and child correction chains for audit review
	- supports local filtering, search, timestamps, and per-chain collapse/expand behavior

## 10. Materials Workflow Rule
Material draft input normalizes `material_code` to lowercase kebab-case before staging.

Example:
- "TMT Steel 12mm" -> "tmt-steel-12mm"

## 11. Environment Contract (Local Dev)
CMS local env must define:
- VITE_API_BASE_URL
- VITE_TENANT_ID
- VITE_TENANT_NAME

For Vercel deployments, the frontend should call the same-origin `/api/v1` path and let `vercel.json` proxy it to the backend.

Backend local env must allow CORS for CMS origin and tenant header (`X-Tenant-ID`).

## 12. Current Scope and Next Steps
Implemented now:
- Tenant-scoped reads
- Tenant-aware cache strategy
- Typed sync contracts
- Operations UI for 207 outcome visibility
- Sync Monitor retry persistence across page reloads
- Immutable correction drafting for successful ledger writes
- Sync Monitor audit tooling: failure badges, timestamps, grouped correction chains, search, counters, and tenant-scoped local clearing

Planned next:
- wire procurement drafts to backend PO write endpoints when available
- add automated unit/integration tests for tenant and 207 behaviors
- formalize backend correction metadata handling and lineage display