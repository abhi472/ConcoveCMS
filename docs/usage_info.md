# ConCoveCMS User Guide and Release Record

ConCoveCMS is the tenant-aware inventory control console for Project Badri Rai. It combines master-data administration, site-level stock controls, procurement, immutable inventory movements, retry handling, and audit visibility in one application.

Production CMS: <https://concove-cms.vercel.app>

## Before You Start

1. Confirm the tenant shown in the header before reading or changing data.
2. Use the sidebar to open Dashboard, Materials, Site Materials, Entities, Operations, or Sync Monitor.
3. Treat inventory ledger entries as permanent. Correct an incorrect entry with a compensating transaction instead of trying to edit history.
4. Keep the browser's local storage enabled. It preserves unfinished purchase-order drafts and failed transaction payloads used by retry workflows.

The active tenant is included in every query key and API request. Changing tenants cancels and clears tenant-sensitive cached queries before loading the newly selected tenant.

## Dashboard

### What It Does

Dashboard gives an operational overview of stock health across the tenant. It combines bounded summary counts, site/entity summaries, priority risks, pending receipts, and direct links into stock movement workflows.

### How To Use It

1. Leave **Site scope** on **All sites** for the tenant-wide view, or select one site for a focused view.
2. Review the summary counts for total stock, low stock, critical stock, and out-of-stock combinations.
3. Scan the inventory table. Each row identifies the site, material, current base-unit quantity, applicable threshold, and status.
4. Use **Record issue** on healthy stock or **Record receipt** on low stock to open Operations with the site, material, and transaction type already selected.
5. Review **Critical alerts** for combinations requiring immediate replenishment.
6. Use **Refresh** to request the latest server-calculated overview.

### How It Helps

- Replaces manual site-by-site stock checks with one tenant-wide view.
- Prioritizes replenishment using configured thresholds rather than guesswork.
- Carries site and material context into Operations, reducing data-entry mistakes.

## Materials

### What It Does

Materials manages the tenant's approved material catalog, units of measure, and conversion factors. Archived materials remain available to historical records but are removed from new operational selection.

### How To Use It

1. Search by material code or description.
2. Filter by **Active**, **Archived**, or **All**, then choose a sort order and page.
3. Select **Add Material** to enter a code, description, base UOM, issue UOM, and conversion factor.
4. Review the normalized code preview before saving. Material codes are standardized in lowercase kebab case.
5. Use **Edit** to update an active material.
6. Use **Details** to inspect the material profile, active site assignments, current site balances, and audit timeline.
7. From Details, choose **Manage sites** to open Site Materials with that material in context.
8. Use **Archive** only after resolving active site assignments and open purchase orders. Use the **Archived** filter and **Restore** to reactivate a material.

### How It Helps

- Prevents duplicate or inconsistent material naming.
- Keeps purchasing units and issue units explicit through conversion factors.
- Shows where a material is active and how much is held before catalog changes are made.
- Preserves historical references through archive/restore instead of destructive deletion.

## Site Materials

### What It Does

Site Materials controls which catalog materials can be used at each site and defines the low and critical stock thresholds that drive Dashboard statuses.

### How To Use It

1. Select a site.
2. Search by material code or description.
3. Enter non-negative **Low threshold** and **Critical threshold** values. The critical threshold cannot exceed the low threshold.
4. Select **Save** to update an assigned material's thresholds.
5. Select **Assign** to activate an unassigned material for the site.
6. Select **Unassign** to stop future use at that site. The API protects assignments that still have non-zero stock or operational dependencies.
7. Select several rows with the checkboxes, then use **Assign selected** or **Unassign selected** for a bulk update.

### How It Helps

- Prevents transactions against materials that are not approved for a site.
- Lets each site use thresholds appropriate to its own consumption pattern.
- Updates many assignments consistently without repetitive row-by-row work.

## Entities

### What It Does

Entities manages the people, organizations, and locations referenced by procurement and inventory movements.

Supported types are:

| Type | Typical Use | Profile Information |
|---|---|---|
| Site | Inventory location and PO destination | Location code, address, manager, capacity notes |
| Vendor | PO supplier and inward source | Contact, phone, GST number, address |
| Employee | Responsible person or movement party | Employee code, designation, phone |
| Subcontractor | External work party | Contact, phone, specialty, registration, address |

### How To Use It

1. Select the **Sites**, **Vendors**, **Employees**, or **Subcontractors** tab.
2. Search by name and filter by **Active**, **Archived**, or **All**.
3. Select **Add** to create an entity. The form changes to match the selected type.
4. Use **Edit** to maintain an active profile.
5. Use **Details** to review profile fields, related site information, stock exceptions for sites, and the audit timeline.
6. For vendors, employees, and subcontractors, use **Manage sites** to add or remove site associations. A person can have one primary site; vendors can have preferred sites.
7. Use **Archive** after resolving blockers such as non-zero site stock, open purchase orders, or active associations. Filter to archived records and use **Restore** when the entity should become operational again.

### How It Helps

- Gives transaction and procurement forms controlled selections instead of free text.
- Keeps operational relationships tenant-scoped and auditable.
- Stops unsafe archival while dependent stock, orders, or associations remain active.

## Operations

Operations contains three work areas: **Procurement Superset**, **Ledger Adjustment**, and **Sync Status**.

### Procurement Superset

#### Create or Update a Purchase Order

1. Enter a unique PO number.
2. Select an active vendor and target site.
3. Optionally enter the expected delivery date.
4. Add one or more line items, selecting a site-approved material and entering quantity and unit rate.
5. Review the payload preview and select **Save Draft**.
6. To continue an existing draft, select **Edit** in Active Orders. The same form updates the server record.

The browser automatically stores unfinished form state per tenant. After a refresh, the draft can be recovered. A stable client request ID makes repeated create requests idempotent.

#### Advance a Purchase Order

1. Find the PO in **Active Orders**.
2. Review its ordered, received, and outstanding quantities.
3. Choose a permitted status and submit the status update.
4. Use the progress tracker to follow **Draft**, **Approved**, **Partial**, and **Completed** stages.

Fulfillment is derived from ledger receipts linked to the PO. Use an approved or partially fulfilled PO when recording an inward ledger transaction; the backend updates fulfillment without rewriting ledger history.

#### How It Helps

- Keeps order lines aligned with materials approved for the destination site.
- Avoids duplicate POs during network retries.
- Connects procurement status to actual inventory receipts.

### Ledger Adjustment

#### Record a Movement

1. Select a site and one of its assigned materials.
2. Choose the movement type:
   - **INWARD** receives stock into a site.
   - **OUTWARD** issues stock from a site.
   - **IST_DISPATCH** sends stock to another site.
   - **IST_RECEIPT** receives a corresponding inter-site transfer.
3. Enter a positive quantity and transaction date.
4. For an inward receipt, optionally link an approved or partially fulfilled PO for the selected site.
5. Select the applicable source and destination entities. Options are constrained by the site and movement type.
6. Expand **Commercial Details** for invoice number, rate, GST tier, and transport charges when required.
7. Expand **Volumetric Dimensions** for dimensions and loaded/empty weights when required.
8. Review the authoritative current balance. Outward and dispatch quantities greater than available stock are blocked.
9. Select **Commit to Ledger**, review the confirmation, and submit.

A fresh `client_transaction_id` is generated immediately before a standard write. The server validates tenant ownership, site-material assignment, entity-site rules, PO eligibility, and stock availability.

#### Correct an Existing Movement

1. Open Sync Monitor and locate the original or correction entry in local correction history.
2. Select **Correction**.
3. Operations opens Ledger Adjustment with the original context and an inverse movement type, such as OUTWARD to INWARD.
4. Enter a required correction reason and review all prefilled values.
5. Commit the compensating entry.

The original ledger row remains unchanged. The new transaction stores `correction_of_transaction_id`, producing durable correction lineage on the backend.

#### Retry a Failed Movement

1. Open Sync Monitor and locate a failed row.
2. Select **Fix & Retry**.
3. Correct the prefilled tenant, site, material, entity, PO, or quantity data.
4. Submit again. Retry mode preserves the original client transaction ID so the server can apply idempotency correctly.

#### Fluid Dispense

Use **Run Fluid Dispense** from the ledger form for supported fluid materials. The operation uses the selected site, material, quantity, destination entity, and transaction date, while the dedicated backend route applies fluid-dispense validation and returns the post-dispense balance.

### Sync Status

After a ledger submission, open **Sync Status** inside Operations to inspect the most recent HTTP 207 result. Each row reports its client transaction ID, success or failure state, and server message. Failed rows are also written to the tenant's local retry queue.

### How Operations Helps

- Combines procurement and stock movement without weakening ledger immutability.
- Shows current balance and validates operational relationships before a write.
- Makes partial batch outcomes visible instead of reducing them to a generic failure.
- Supports recoverable drafts, idempotent writes, corrections, and retries.

## Sync Monitor

### What It Does

Sync Monitor separates local retry assistance from server-authoritative history. It displays failed submissions, successful ledger rows, master-data audit events, and locally prepared correction chains.

### Failed Rows

1. Search by transaction ID, message, or correction reason.
2. Review the failure category and backend message.
3. Select **Fix & Retry** to reopen the payload in Operations.
4. Use **Correction** only when a successful parent exists and a compensating transaction is appropriate.

Failed rows are held in browser local storage for the active tenant. They support recovery but are not the authoritative ledger.

### Successful Ledger History

1. Search for a transaction or filter by movement type.
2. Use pagination to move through server history.
3. Select **Details** to inspect movement, site, material, source/destination, PO, commercial data, volumetric data, correction parent, and correction reason.
4. Use **Refresh** to query the backend again.

This table is server-authoritative and remains available independently of local browser history.

### Master Data Audit

1. Filter by resource type: material, entity, site-material assignment, or purchase order.
2. Filter by action: create, update, archive, restore, assign, unassign, or status change as available.
3. Review the actor, resource ID, event timestamp, and recorded changes.
4. Use pagination and **Refresh** for additional events.

Audit triggers record mutations made after the audit schema was deployed. Older unchanged records do not gain synthetic historical events.

### Local Correction Draft History

Use **All Entries**, **Original Entries**, and **Correction Chains** to inspect correction drafts retained by this browser. The grouping helps reopen a correction workflow, while the Successful Ledger History remains the durable source of truth.

### Clear Local History

**Clear Local History For [tenant]** removes only the active tenant's browser-cached failed rows and correction draft history. It does not delete server ledger transactions, purchase orders, master data, or audit events.

### How It Helps

- Gives operators the exact backend reason for each failed write.
- Keeps retries and immutable corrections distinct.
- Provides server-side transaction and audit evidence for investigation.
- Prevents local retry data from being mistaken for authoritative inventory history.

## Common Workflows

### Onboard a New Site

1. Create the site in Entities.
2. Open Site Materials and assign the permitted materials.
3. Set low and critical thresholds for each assignment.
4. Associate relevant employees, subcontractors, and preferred vendors with the site.
5. Confirm the site appears on Dashboard.

### Receive a Purchase Order

1. Create and approve the PO in Operations.
2. Open Ledger Adjustment and choose **INWARD**.
3. Select the PO's target site and material.
4. Link the PO, enter the received quantity, and commit.
5. Review PO fulfillment and the new balance.
6. Confirm the transaction in Sync Monitor's Successful Ledger History.

### Resolve a Failed Transaction

1. Read the failed row's category and server message in Sync Monitor.
2. Select **Fix & Retry**.
3. Correct the invalid mapping or value in Operations.
4. Submit and inspect Sync Status.
5. Confirm success in the server ledger history.

### Correct a Wrong Ledger Entry

1. Do not edit or delete the original row.
2. Start **Correction** from Sync Monitor.
3. Verify the inverse movement and quantity.
4. Enter a meaningful correction reason.
5. Commit and confirm both rows in server history.

## Safety and Troubleshooting

- **Wrong tenant:** Stop before submitting. Switch tenants in the header and reselect all operational context.
- **Material unavailable in Operations:** Assign it to the site in Site Materials and ensure neither record is archived.
- **Cannot archive:** Resolve the dependency named by the API, such as open POs, active assignments, non-zero stock, or site associations.
- **Cannot issue or dispatch:** Compare the requested quantity with the authoritative balance shown in Ledger Adjustment.
- **PO unavailable for receipt:** Confirm it targets the selected site and is Approved or Partially Fulfilled.
- **Failed row disappeared:** Local failed history is browser-specific and may have been cleared. Check Successful Ledger History to determine whether the server accepted the transaction.
- **No audit events for old records:** Audit events begin with mutations made after the audit triggers were deployed.

## Implementation and Commit Cross-Reference

The following commits comprise the implemented plan in this repository. Hashes link each user-facing capability to its source-control checkpoint.

| Commit | Change Delivered | Main User Impact |
|---|---|---|
| `9576daa` | Initial React/Vite CMS, tenant and sync contexts, baseline Dashboard, Materials, Entities, Operations, Sync Monitor, reusable PO progress and material-code components, and core documentation | Established the complete application shell and original workflows |
| `677f8cc` | Vercel environment template and rewrite configuration | Enabled the CMS to be hosted on Vercel and route `/api/v1` requests |
| `ff1ddd6` | First production CORS/routing correction across Axios, tenant setup, Vercel, and documentation | Aligned browser requests with the tenant-aware backend |
| `2224051` | Finalized same-origin API routing with Vite development proxy and simplified production client configuration | Removed direct browser-to-Render CORS dependence while keeping local development functional |
| `b79f344` | Server-backed inventory dashboard, status models, summaries, critical alerts, site scoping, and Operations deep links | Turned Dashboard into an actionable stock-health view |
| `f17d8dc` | Site Materials route, API service, assignment table, thresholds, and sidebar navigation | Added site-level material eligibility and alert configuration |
| `a44923b` | Full material and entity CRUD, archive/restore behavior, detail surfaces, filters, pagination, associations foundation, and API documentation | Made tenant master data operationally manageable rather than read-only |
| `4f4a2c9` | Purchase-order service and Procurement Superset create/update/list/status workflows | Added persistent procurement and lifecycle management |
| `71eef12` | PO synchronization refinements and ledger receipt integration | Connected purchase-order status and fulfillment to inventory activity |
| `de0ee43` | Offline/local recovery improvements, authoritative balance lookup, bulk assignments, transaction history, audit APIs, richer entity/material details, and expanded Sync Monitor | Completed recovery, server-history, audit, and operational validation workflows |
| `372bf02` | Hooks-safe correction/retry initialization, direct same-page loaders, stable entity dependencies, split context consumer hooks, and corrected Sync Monitor authority wording | Removed the pinned React diagnostic and preserved correction/retry behavior without effect-driven state updates |

## Production Verification

The release at commit `372bf02` was verified on 27 July 2026 after deployment.

- Production asset: `index-DNaTp33j.js`
- Routes verified with HTTP 200: Dashboard, Materials, Site Materials, Entities, Operations, and Sync Monitor
- Tenant verified: Badri Rai Construction (`d20a5d4b-15cd-4655-b7af-fa2add978e5a`)
- Browser console errors: none
- Failed production network responses during route verification: none
- Local validation before deployment: repository lint passed, TypeScript/Vite production build passed, and editor diagnostics were clear
- Correction regression: an OUTWARD source hydrated as a compensating INWARD draft, retained quantity and parent lineage, consumed the correction query parameter, and produced no runtime error

No production master data, purchase orders, or ledger transactions were created solely for release verification.