# ConCoveCMS - Project Badri Rai Web Admin Console

A React + TypeScript admin interface for managing construction inventory across 25+ sites. Built with Vite, Tailwind CSS, and React Query.

## Quick Start

```bash
npm install
npm run dev      # Start dev server on http://localhost:5173
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

## Project Structure

```
src/
├── api/              # HTTP client, API services, query keys
├── components/       # Reusable UI components (Sidebar, POProgressTracker, etc.)
├── context/          # React Context (TenantContext, SyncRetryContext)
├── pages/            # Page-level components (Dashboard, Materials, Operations, etc.)
├── types/            # TypeScript schema definitions
├── App.tsx           # Main app component with routing
├── main.tsx          # Entry point
└── index.css         # Tailwind directives
```

## Architecture Overview

### Tech Stack
- **Framework:** React 19 + TypeScript
- **Build:** Vite 8
- **Styling:** Tailwind CSS v4
- **Routing:** react-router-dom v7
- **Data Fetching:** @tanstack/react-query v5
- **HTTP Client:** axios

### Key Patterns

**Tenant Isolation:** All data operations are scoped to a single tenant via:
- `TenantContext` for UI state
- React Query keys include tenant ID
- Axios interceptor adds `X-Tenant-ID` header

**Immutable Ledger:** Transaction records cannot be edited; corrections use compensating entries:
- `correction_of_transaction_id` tracks parent transaction
- `correction_reason` documents the correction
- Sync Monitor displays correction chains

**Partial-Success Handling:** HTTP 207 multi-status responses indicate per-record sync outcomes:
- Failed records persist in `SyncRetryContext` (localStorage)
- Operators can retry or create corrections
- Success records stored in sync history

## Core Pages

| Page | Purpose |
|------|----------|
| **Dashboard** | Inventory heatmap across all sites, critical stockout alerts |
| **Materials** | Material catalog with kebab-case code normalization, UOM mapping |
| **Entities** | Site, Vendor, Subcontractor, Employee management |
| **Operations** | Procurement drafting, ledger adjustments, sync batch interface |
| **Sync Monitor** | Failed record queue, retry workflows, correction tracking |

## Recent Improvements

✅ Fixed Tailwind CSS v4 compilation - Updated PostCSS config and CSS imports
✅ CSS density optimizations - Reduced padding/spacing across all pages (p-5→p-3, gap-4→gap-3)
✅ PO Progress Tracker - Visual timeline for purchase order stages
✅ Material Code Normalizer - Live preview of kebab-case transformation
✅ Enhanced button styling - Improved visual hierarchy with shadows and hover states

## Environment Variables

```env
VITE_TENANT_ID=<default-tenant-uuid>
VITE_TENANT_NAME=<default-tenant-name>
```

The app always calls `/api/v1`. Vercel rewrites that path to the backend in production, and the Vite dev server proxies it to Render during local development.

## API Integration

The CMS communicates with a Node.js REST backend at:
- `GET /api/v1/sync/master-data` - Fetch tenant-scoped catalogs
- `POST /api/v1/sync/transactions/batch` - Submit batch inventory transactions
- `POST /api/v1/inventory/fluid-dispense` - Rapid fluid inventory dispense

All endpoints require `tenant_id` parameter and `X-Tenant-ID` header (added automatically).

## Local Persistence

SyncRetryContext manages browser localStorage:
- Failed records: Max 100 per tenant
- Sync history: Successful transaction records for correction workflow

## Documentation

Refer to `docs/` folder for detailed architecture and API specifications.
