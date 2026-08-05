# Copilot Instructions for ConCoveCMS

## Mission
Deliver production-safe, tenant-aware inventory CMS changes with clear validation and release handoff.

## Workflow Rules
- Work in small milestones: implement, validate, document, then handoff.
- Start a fresh chat for each major phase (feature build, production verification, docs cleanup) to avoid context bloat.
- Prefer actionable execution over proposal text when the request implies implementation.

## Deployment Ownership
- The user owns deployment.
- Do not deploy, commit, push, or create pull requests unless explicitly asked.

## Production Safety
- Never create or mutate production business records for verification unless explicitly approved for a specific record.
- Prefer read-only verification: route checks, page load checks, API status checks, and console/network error checks.
- Treat backend ledger history as immutable. Corrections must be compensating entries with clear reason.

## Tenant and Data Integrity
- Keep tenant context explicit in analysis and test steps.
- Preserve tenant-scoped validation behavior for entities, materials, assignments, purchase orders, and ledger writes.
- Do not suggest bypassing server validation or idempotency constraints.

## Validation Standard
For meaningful changes, run and report:
- CMS lint and build
- Backend build and tests when backend files are affected
- Diff scope and whitespace checks

## Documentation Standard
When features or behavior change:
- Update operator-facing usage docs with how to use and why it helps.
- Cross-reference behavior with relevant commits and released scope.
- Remove stale claims that conflict with implemented behavior.

## Handoff Format
Provide concise handoff sections:
1. What changed
2. What was validated
3. What remains (if anything)
4. Explicit note that deployment is user-owned
