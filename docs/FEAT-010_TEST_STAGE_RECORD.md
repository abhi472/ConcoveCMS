# FEAT-010 Test Stage Record

Date: 2026-08-08

This record tracks stage tasks that are test-related or validation-gate related, with latest known evidence.

## Task Matrix

| Stage Task | Status | Evidence / Notes |
| --- | --- | --- |
| 0.2 Record request count and transferred bytes for core loop | Partial | Current measured loop (Dashboard -> Analytics -> Materials -> Dashboard): requestCount=15, responseBytes=4541. Stage-0 baseline snapshot still missing, so direct delta not finalized. |
| 0.3 Add shell, route identity, viewport overflow assertions | Complete | Playwright release-gate assertions now validate route readiness and horizontal overflow across desktop/tablet/mobile. |
| 0.4 Freeze legacy route/deep-link and RBAC expectations | Complete | Focused RBAC and route denial suites updated and passing. |
| 3.7 Compare request and transfer metrics with Stage 0 | Blocked | Current metrics captured; baseline values not recorded in Stage 0 artifacts yet. |
| 7.5 Test fresh-cache route reuse, slow network, offline recovery, logout clearing | Complete | Focused E2E flow validating auth/cache behavior is passing. |
| 8.1 Run frontend build and lint | Complete with warnings | Latest lint run: 0 errors, 5 warnings. |
| 8.2 Run focused Dashboard/Analytics/Materials/Directory/Auth/RBAC E2E | Complete | Focused batch passed (23/23). |
| 8.3 Run backend contract and regression tests | Blocked | Vitest error: "Vitest failed to find the runner" across integration suites. |
| 8.4 Verify keyboard, focus, status accessibility, no horizontal overflow | Complete | Dedicated accessibility gate spec passes after tablet overflow fix in materials workspace. |
| 8.5 Capture final responsive screenshots and request/byte comparison | Partial | Screenshots captured for login/dashboard/analytics/materials/sites at 1366x768, 768x1024, 390x844. Metrics comparison still pending Stage-0 baseline values. |

## Frontend-specific Validation Notes

- Added a metrics harness spec that emits deterministic network request and payload-byte values.
- Added accessibility and responsive gate spec for keyboard focus and overflow checks.
- Captured responsive screenshot evidence set under docs/images/feat-010-stage8.
