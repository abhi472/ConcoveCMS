import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'fs/promises'
import {
  bootstrapAuthenticatedSession,
  installSafetyNetMocks,
  mockAnalyticsOverview,
  mockMasterData,
  mockMaterials,
} from './support/api-mocks'
import { ENTITIES, MATERIALS } from './support/fixtures'

const SCREENSHOT_DIR = 'docs/images/feat-010-stage8'

const VIEWPORTS = [
  { width: 1366, height: 768, label: '1366x768' },
  { width: 768, height: 1024, label: '768x1024' },
  { width: 390, height: 844, label: '390x844' },
]

const ROUTES = [
  {
    path: '/',
    label: 'dashboard',
    ready: (page: Page) =>
      expect(page.getByText('Tracked materials', { exact: true })).toBeVisible(),
  },
  {
    path: '/analytics',
    label: 'analytics',
    ready: (page: Page) =>
      expect(page.getByRole('button', { name: 'Refresh analytics' })).toBeVisible(),
  },
  {
    path: '/materials',
    label: 'materials',
    ready: (page: Page) =>
      expect(page.getByRole('heading', { level: 2, name: 'Material Catalog' })).toBeVisible(),
  },
  {
    path: '/sites',
    label: 'sites',
    ready: (page: Page) =>
      expect(page.getByRole('button', { name: 'Add Site' })).toBeVisible(),
  },
]

test.describe('FEAT-010 release gate accessibility and responsive evidence', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page)

    await mockMasterData(page, {
      materials: MATERIALS,
      entities: ENTITIES,
      purchase_orders: [],
    })
    await mockMaterials(page, MATERIALS)
    await mockAnalyticsOverview(page, {
      generated_at: new Date().toISOString(),
      data: {
        range_days: 30,
        summary: {
          seven_day_inward_units: 3225,
          seven_day_outward_units: 2455,
          fulfillment_ratio_percent: 82.3,
          projected_spend_month: 4280000,
        },
        material_usage: [
          { date: '2026-08-01', INWARD: 420, OUTWARD: 250 },
          { date: '2026-08-02', INWARD: 390, OUTWARD: 280 },
        ],
        po_allocation: [
          { date: 'CEMENT-OPC', Allocated: 780, Fulfilled: 620 },
          { date: 'STEEL-TMT', Allocated: 560, Fulfilled: 540 },
        ],
      },
    })

    await mkdir(SCREENSHOT_DIR, { recursive: true })
  })

  test('verifies keyboard focus and no horizontal overflow across core authenticated routes', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      for (const route of ROUTES) {
        await page.goto(route.path)
        await route.ready(page)

        await page.keyboard.press('Tab')
        const focusedElementTag = await page.evaluate(() => document.activeElement?.tagName ?? null)
        expect(focusedElementTag).not.toBeNull()
        expect(focusedElementTag).not.toBe('BODY')

        const overflowDelta = await page.evaluate(() => {
          const root = document.documentElement
          const body = document.body
          return {
            root: root.scrollWidth - root.clientWidth,
            body: body.scrollWidth - body.clientWidth,
          }
        })
        const maxOverflow = Math.max(overflowDelta.root, overflowDelta.body)
        expect(
          maxOverflow,
          `Horizontal overflow on ${route.path} at ${viewport.label}: root=${overflowDelta.root}, body=${overflowDelta.body}`,
        ).toBeLessThanOrEqual(1)
      }
    }
  })

  test('captures final responsive screenshots for dashboard, analytics, materials, and sites', async ({ page }) => {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      for (const route of ROUTES) {
        await page.goto(route.path)
        await route.ready(page)

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${route.label}-${viewport.label}.png`,
          fullPage: true,
        })
      }
    }
  })
})
