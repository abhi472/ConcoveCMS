# Changelog

All notable changes to the ConCoveCMS frontend are documented in this file.

## [Unreleased]
### Known blockers
- FEAT-010 Stage 8.5 baseline comparison is still partial because Stage 0 baseline request/byte values were not captured before later optimization runs.

## [2026-08-08]
### Added
- FEAT-010 release-gate evidence set:
  - responsive screenshot coverage for login, dashboard, analytics, materials, and sites across desktop/tablet/mobile viewports
  - metrics spec that emits request and response-byte telemetry for the core route loop
  - accessibility and keyboard/overflow checks for release gating
- FEAT-010 test-stage evidence document in CMS docs.

### Changed
- Shell identity and navigation behavior refined into a minimal control-room pattern with tenant-aware cache policy defaults.
- Dashboard rendering consolidated around bounded operational cards and reduced duplication.
- Materials workspace consolidated with route redirect from legacy site-materials entrypoint.
- Directory experience decomposed into type-specific routes while preserving role restrictions.

## [2026-08-07]
### Added
- FEAT-009 analytics delivery:
  - adapter chart layer
  - domain analytics widgets
  - analytics page route and navigation
  - analytics Playwright coverage
- Expanded CSV upload workflows for entities, materials, and operations.

### Changed
- Authentication/header assertion stability improved in E2E support and test utilities.
- API/docs index updated for FEAT-009 release-readiness reporting.

## [2026-08-05]
### Added
- FEAT-007 RBAC user experience:
  - login and protected routing
  - users administration page
  - role-based sidebar/action gating
  - RBAC route-denial and auth E2E suites
- Playwright framework and support infrastructure for deterministic route-mocked E2E.

### Changed
- Tenant and auth context handling upgraded for session-backed role-aware navigation.

## [2026-08-04]
### Added
- FEAT-005 and FEAT-004 UI workflows for site transfers and bulk PO approvals.
- Reusable PO status badges and selection-based approval UX.
- FEAT-003 equipment registry UI, equipment services, and fluid-dispense equipment selection.
- Master-data and equipment E2E suites.

### Changed
- Operations sync and offline retry paths hardened for production flows.

## [2026-07]
### Added
- Initial React 19 + TypeScript + Vite CMS foundation deployed to Vercel.
- Core pages for dashboard, materials, entities, and operations.
- Early tenant-scoped data interaction and operator workflow baseline.

## Notes
- Historical entries are compiled from roadmap/spec archives and repository commit history to maintain continuity from initial rollout through current FEAT cycles.
