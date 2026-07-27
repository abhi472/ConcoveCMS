# Documentation Index

This folder contains essential project documentation. Some files have been consolidated to reduce redundancy.

## Essential Documentation (Keep)

### 1. **CMS_ARCHITECTURE.md** ⭐ CORE
Complete frontend architecture including:
- Tenant isolation patterns
- React Query strategy  
- API integration layer
- UI component structure
- Sync workflows (batch, corrections, retries)
- Immutable ledger patterns
- Operations control workspace

**When to use:** Understanding how the frontend works, component architecture, data flow.

### 2. **design_doc.md** ⭐ DESIGN
UI/UX specifications including:
- Layout shell (sidebar, header, tenant selector)
- Dashboard God View (heatmap, alerts)
- Material Catalog with code normalization
- Operations workspace (procurement, ledger, sync inspector)
- Entity management
- Design principles and color scheme

**When to use:** UI implementation, visual design decisions, mockup references.

### 3. **API_REFERENCE.md** ⭐ API
Condensed API contract reference:
- Backend endpoint specifications
- Request/response schemas
- Error handling (400, 207 multi-status)
- Tenant scoping requirements
- Implementation notes

**When to use:** Implementing API calls, understanding error handling, frontend-backend alignment.

### 4. **usage_info.md** ⭐ USER GUIDE
Operator-focused application guide including:
- Step-by-step instructions for every module
- Operational benefits and safety constraints
- Common procurement, receipt, retry, and correction workflows
- Commit-by-commit implementation cross-reference
- Production release verification record

**When to use:** Training users, running daily inventory workflows, troubleshooting failed operations, or reviewing delivered scope.

---

## Redundant/Archived Documentation

The following files contained overlapping content and have been consolidated:

- ❌ **SYSTEM_CONTEXT.md** → Merged into README.md and CMS_ARCHITECTURE.md
- ❌ **INTEGRATION_GUIDE.md** → Condensed into API_REFERENCE.md  
- ❌ **BACKEND_ARCHITECTURE.md** → Not needed for frontend (backend schema only)
- ❌ **API_CONTRACTS.md** → Condensed into API_REFERENCE.md

---

## Quick Navigation

**New to the project?** Start with:
1. README.md (overview and setup)
2. usage_info.md (operator workflows)
3. design_doc.md (visual walkthrough)
4. CMS_ARCHITECTURE.md (how it works)

**Building a feature?** Reference:
1. CMS_ARCHITECTURE.md (component patterns)
2. API_REFERENCE.md (API endpoints)
3. design_doc.md (UI specs)

**Debugging an issue?** Check:
1. CMS_ARCHITECTURE.md (data flow)
2. API_REFERENCE.md (error handling)

---

## Visual Assets

- `dashboard.png` - Dashboard mockup (inventory heatmap)
- `all_modules.png` - Full module overview

---

## File Sizes Summary

| File | Lines | Purpose |
|------|-------|---------|
| CMS_ARCHITECTURE.md | ~180 | Core frontend arch & patterns |
| design_doc.md | ~150 | UI/UX specifications |
| API_REFERENCE.md | ~100 | API contracts (condensed) |
| usage_info.md | ~320 | Operator guide and release record |

---

**Last Updated:** 2026-07-27
**Status:** Consolidated and production-ready
