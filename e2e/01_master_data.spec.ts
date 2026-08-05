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

  test('displays the active tenant and authenticated user in the workspace header', async ({ page }) => {
    await mockMasterData(page, { materials: [], entities: [], purchase_orders: [] })

    await page.goto('/')

    await expect(page.getByRole('heading', { level: 1, name: 'Badri Rai Construction' })).toBeVisible()
    await expect(page.getByText('User: admin@concove.test')).toBeVisible()
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
