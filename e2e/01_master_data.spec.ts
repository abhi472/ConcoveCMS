import { test, expect } from '@playwright/test'
import {
  bootstrapAuthenticatedSession,
  installSafetyNetMocks,
  mockEntities,
  mockEquipment,
  mockInventoryBalances,
  mockMasterData,
  mockMaterials,
  mockTransactionsBatch,
} from './support/api-mocks'
import { ENTITIES, MATERIAL_CEMENT, MATERIAL_STEEL, MATERIALS, SITE_ALPHA, VENDOR_ACME } from './support/fixtures'

test.describe('Master data workflows', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page)
  })

  test('displays tenant context and authenticated user in navigation shell', async ({ page }) => {
    await mockMasterData(page, { materials: [], entities: [], purchase_orders: [] })

    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1, name: 'ConCoveCMS' })).toBeVisible()
    await expect(page.getByText('Badri Rai Construction', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()
  })

  test('filters the material catalog by search term', async ({ page }) => {
    await mockMasterData(page, { materials: [], entities: [], purchase_orders: [] })
    await mockMaterials(page, MATERIALS)

    await page.goto('/materials')

    await expect(page.getByText(MATERIAL_CEMENT.material_code)).toBeVisible()
    await expect(page.getByText(MATERIAL_STEEL.material_code)).toBeVisible()

    await page.getByLabel('Search').fill('steel')

    await expect(page.getByText(MATERIAL_STEEL.material_code)).toBeVisible()
    await expect(page.getByText(MATERIAL_CEMENT.material_code)).not.toBeVisible()
  })

  test('reuses cached dashboard data when navigating between workspace routes', async ({ page }) => {
    let dashboardRequests = 0
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/inventory/dashboard')) {
        dashboardRequests += 1
      }
    })

    await mockMasterData(page, {
      materials: MATERIALS,
      entities: ENTITIES,
      purchase_orders: [],
    })

    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Materials' })).toBeVisible()

    await page.goto('/materials')
    await expect(page.getByRole('heading', { level: 2, name: 'Material Catalog' })).toBeVisible()

    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Materials' })).toBeVisible()
    expect(dashboardRequests).toBeGreaterThanOrEqual(1)
    expect(dashboardRequests).toBeLessThanOrEqual(2)
  })

  test('keeps cached workspace routes usable while offline', async ({ page }) => {
    await mockMasterData(page, {
      materials: MATERIALS,
      entities: ENTITIES,
      purchase_orders: [],
    })

    await page.goto('/materials')
    await expect(page.getByRole('heading', { level: 2, name: 'Material Catalog' })).toBeVisible()

    await page.context().setOffline(true)
    await page.getByRole('link', { name: 'Sites' }).click()

    await expect(page.getByRole('heading', { level: 2, name: 'Sites' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Site' })).toBeVisible()
    await page.context().setOffline(false)
  })

  test('shows a loading skeleton while dashboard inventory data is slow', async ({ page }) => {
    await mockMasterData(page, {
      materials: MATERIALS,
      entities: ENTITIES,
      purchase_orders: [],
    })
    await page.route('**/api/v1/inventory/dashboard**', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      await new Promise((resolve) => setTimeout(resolve, 200))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generated_at: new Date().toISOString(),
          data: {
            summary: {
              material_count: 2,
              low_stock_count: 0,
              critical_stock_count: 0,
              out_of_stock_count: 0,
            },
            sites: [
              { id: SITE_ALPHA.id, name: SITE_ALPHA.name },
            ],
            entity_counts: [
              { entity_type: 'INTERNAL_SITE', entity_count: 1 },
              { entity_type: 'VENDOR', entity_count: 1 },
              { entity_type: 'EMPLOYEE', entity_count: 0 },
              { entity_type: 'SUBCONTRACTOR', entity_count: 0 },
            ],
            site_summaries: [],
            priority_risks: [],
            pending_receipts: [],
            recent_movements: [],
          },
        }),
      })
    })

    await page.goto('/')
    await expect(page.getByLabel('Loading inventory')).toBeVisible()
    await expect(page.getByText('Tracked materials', { exact: true })).toBeVisible()
  })

  test('switches to site assignments mode from materials workspace', async ({ page }) => {
    await mockMasterData(page, {
      materials: MATERIALS,
      entities: ENTITIES,
      purchase_orders: [],
    })
    await mockMaterials(page, MATERIALS)
    await page.route('**/api/v1/inventory/site-materials**', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              site_id: SITE_ALPHA.id,
              site_name: SITE_ALPHA.name,
              material_id: MATERIAL_CEMENT.id,
              material_code: MATERIAL_CEMENT.material_code,
              material_description: MATERIAL_CEMENT.description,
              base_uom_id: MATERIAL_CEMENT.base_uom_id,
              low_stock_threshold: '100',
              critical_stock_threshold: '20',
              is_active: true,
              deactivated_at: null,
              updated_at: new Date().toISOString(),
            },
          ],
        }),
      })
    })

    await page.goto('/materials')
    await page.getByRole('button', { name: 'Site assignments' }).click()

    await expect(page).toHaveURL(/\/materials\?view=assignments/)
    await expect(page.getByRole('heading', { level: 2, name: 'Site Materials' })).toBeVisible()
    await expect(page.getByLabel('Search materials')).toBeVisible()
    await expect(page.getByText(MATERIAL_CEMENT.material_code)).toBeVisible()
  })

  test('redirects legacy site-materials links to materials assignments while preserving context', async ({ page }) => {
    await mockMasterData(page, {
      materials: MATERIALS,
      entities: ENTITIES,
      purchase_orders: [],
    })
    await page.route('**/api/v1/inventory/site-materials**', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      })
    })

    await page.goto(`/site-materials?material=${encodeURIComponent(MATERIAL_STEEL.material_code)}&site=${SITE_ALPHA.id}`)

    await expect(page).toHaveURL(new RegExp(`/materials\\?view=assignments.*material=${encodeURIComponent(MATERIAL_STEEL.material_code)}.*site=${SITE_ALPHA.id}`))
    await expect(page.getByRole('button', { name: 'Site assignments' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Site Materials' })).toBeVisible()
    await expect(page.getByLabel('Search materials')).toHaveValue(MATERIAL_STEEL.material_code)
  })

  test('records an inward inventory ledger adjustment', async ({ page }) => {
    await mockMasterData(page, {
      materials: [MATERIAL_CEMENT],
      entities: ENTITIES,
      purchase_orders: [],
    })
    await mockEntities(page, [SITE_ALPHA, VENDOR_ACME])
    await mockEquipment(page, [])
    await mockInventoryBalances(page, [
      {
        site_id: SITE_ALPHA.id,
        material_id: MATERIAL_CEMENT.id,
        material_code: MATERIAL_CEMENT.material_code,
        material_description: MATERIAL_CEMENT.description,
        base_uom_id: MATERIAL_CEMENT.base_uom_id,
        quantity_base_uom: 1000,
        low_stock_threshold: '100',
        critical_stock_threshold: '20',
        status: 'OK',
        updated_at: new Date().toISOString(),
      },
    ])
    await mockTransactionsBatch(page, {
      results: [{ client_transaction_id: 'ignored', sync_status: 'SUCCESS', message: 'Recorded.' }],
    })

    page.on('dialog', (dialog) => dialog.accept())

    await page.goto('/operations?mode=ledger')

    await page.getByLabel('Site').selectOption({ label: SITE_ALPHA.name })
    await page.getByLabel('Material').selectOption({ label: MATERIAL_CEMENT.material_code })
    await page.getByLabel('Quantity').fill('50')

    await page.getByRole('button', { name: 'Commit to Ledger' }).click()

    await expect(page.getByText(/site_id and material_id are required/)).toHaveCount(0)

    await page.getByRole('button', { name: 'Sync Status' }).click()
    await expect(page.getByText('SUCCESS', { exact: true })).toBeVisible()
  })
})
