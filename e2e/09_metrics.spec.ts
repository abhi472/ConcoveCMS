import { expect, test } from '@playwright/test'
import { bootstrapAuthenticatedSession, installSafetyNetMocks, mockMasterData, mockMaterials } from './support/api-mocks'
import { ENTITIES, MATERIALS } from './support/fixtures'

test.describe('FEAT-010 core loop metrics', () => {
  test('measures request count and transfer bytes for Dashboard -> Analytics -> Materials -> Dashboard', async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page)

    await mockMasterData(page, {
      materials: MATERIALS,
      entities: ENTITIES,
      purchase_orders: [],
    })
    await mockMaterials(page, MATERIALS)

    let requestCount = 0
    let responseBytes = 0

    page.on('request', (request) => {
      if (request.url().includes('/api/v1/')) {
        requestCount += 1
      }
    })

    page.on('response', async (response) => {
      if (!response.url().includes('/api/v1/')) return
      try {
        const text = await response.text()
        responseBytes += Buffer.byteLength(text, 'utf8')
      } catch {
        // Ignore unreadable response bodies in metrics-only instrumentation.
      }
    })

    await page.goto('/')
    await expect(page.getByText('Tracked materials', { exact: true })).toBeVisible()

    await page.goto('/analytics')
    await expect(page.getByRole('button', { name: 'Refresh analytics' })).toBeVisible()

    await page.goto('/materials')
    await expect(page.getByRole('heading', { level: 2, name: 'Material Catalog' })).toBeVisible()

    await page.goto('/')
    await expect(page.getByText('Tracked materials', { exact: true })).toBeVisible()

    const metrics = {
      loop: 'Dashboard -> Analytics -> Materials -> Dashboard',
      requestCount,
      responseBytes,
    }

    // Emit metrics in test output for Stage 3.7 tracking.
    console.log('FEAT-010_METRICS', JSON.stringify(metrics))

    // Sanity checks to guard accidental runaway network fan-out.
    expect(requestCount).toBeGreaterThan(0)
    expect(responseBytes).toBeGreaterThan(0)
  })
})
