import { expect, test } from '@playwright/test'
import {
  bootstrapAuthenticatedSession,
  installSafetyNetMocks,
  mockAnalyticsOverview,
} from './support/api-mocks'

test.describe('Analytics dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page)
  })

  test('renders analytics overview with widgets and charts', async ({ page }) => {
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
          { date: '2026-08-03', INWARD: 455, OUTWARD: 305 },
        ],
        po_allocation: [
          { date: 'CEMENT-OPC', Allocated: 780, Fulfilled: 620 },
          { date: 'STEEL-TMT', Allocated: 560, Fulfilled: 540 },
        ],
      },
    })

    await page.goto('/analytics')

    await expect(page.getByText('Site scope')).toBeVisible()
    await expect(page.getByText('7D Inward Units')).toBeVisible()
    await expect(page.getByText('7D Outward Units')).toBeVisible()
    await expect(page.getByText('Fulfillment Ratio')).toBeVisible()
    await expect(page.getByText('Projected Spend')).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'Material Consumption Velocity' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 3, name: 'PO Allocation vs Fulfillment' })).toBeVisible()
  })

  test('shows api error state and supports retry', async ({ page }) => {
    await page.route('**/api/v1/analytics/overview**', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Failed to load analytics overview.' }),
      })
    })

    await page.goto('/analytics')
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/analytics/overview') &&
        response.request().method() === 'GET' &&
        response.status() === 500,
      { timeout: 20_000 },
    )

    await expect(page.getByText('Analytics overview is unavailable')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  })
})
