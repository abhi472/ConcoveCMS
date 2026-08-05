import { test, expect } from '@playwright/test'
import { installSafetyNetMocks, mockMasterData, mockSiteTransfers } from './support/api-mocks'
import { MATERIAL_CEMENT, SITE_ALPHA, SITE_BETA } from './support/fixtures'

const TRANSFER_ALPHA_TO_BETA = {
  id: 'transfer-1',
  tenant_id: 'test-tenant',
  source_site_id: SITE_ALPHA.id,
  destination_site_id: SITE_BETA.id,
  source_site_name: SITE_ALPHA.name,
  destination_site_name: SITE_BETA.name,
  transfer_status: 'DISPATCHED',
  dispatched_at: new Date().toISOString(),
  received_at: null,
  created_at: new Date().toISOString(),
  lines: [
    {
      id: 'line-1',
      material_id: MATERIAL_CEMENT.id,
      material_code: MATERIAL_CEMENT.material_code,
      material_description: MATERIAL_CEMENT.description,
      quantity_dispatched: 100,
      quantity_received: 0,
    },
  ],
}

test.describe('Site-to-site (IST) transfer workspace', () => {
  test.beforeEach(async ({ page }) => {
    await installSafetyNetMocks(page)
    await mockMasterData(page, {
      materials: [MATERIAL_CEMENT],
      entities: [SITE_ALPHA, SITE_BETA],
      purchase_orders: [],
    })
  })

  test('navigates to the IST workspace', async ({ page }) => {
    await mockSiteTransfers(page, { outgoingBySourceSiteId: {}, incomingByDestinationSiteId: {} })

    await page.goto('/')
    await page.getByRole('link', { name: /site.?transfers/i }).click()

    await expect(page).toHaveURL(/\/site-transfers$/)
    await expect(page.getByRole('heading', { name: 'Site-to-Site Transfers' })).toBeVisible()
  })

  test('switches between Outgoing, In-Transit, and Incoming tabs', async ({ page }) => {
    await mockSiteTransfers(page, {
      outgoingBySourceSiteId: { [SITE_ALPHA.id]: [TRANSFER_ALPHA_TO_BETA] },
      incomingByDestinationSiteId: {},
    })

    await page.goto('/site-transfers')

    // My Site defaults to the first site (Site Alpha), which is the transfer's source.
    await expect(page.getByRole('button', { name: 'Outgoing Shipments' })).toHaveClass(/border-slate-900/)
    await expect(page.locator('table').getByText(SITE_BETA.name)).toBeVisible()

    await page.getByRole('button', { name: 'In-Transit' }).click()
    await expect(page.getByText('DISPATCHED', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Incoming / Ready to Receive' }).click()
    await expect(page.getByText('No transfers in this view.')).toBeVisible()
  })

  test('opens the Dispatch Transfer slide-over and submits a new transfer', async ({ page }) => {
    await mockSiteTransfers(page, { outgoingBySourceSiteId: {}, incomingByDestinationSiteId: {} })
    await page.goto('/site-transfers')

    await page.getByRole('button', { name: 'Dispatch Transfer' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Dispatch Transfer' })).toBeVisible()

    await dialog.getByLabel('Destination site').selectOption({ label: SITE_BETA.name })
    // The per-line material <select> has no <label>; it's the second combobox in the form.
    await dialog.getByRole('combobox').nth(1).selectOption({ label: MATERIAL_CEMENT.material_code })
    await dialog.getByPlaceholder('Qty').fill('25')

    await dialog.getByRole('button', { name: 'Dispatch Transfer' }).click()

    await expect(page.getByText('Transfer dispatched successfully.')).toBeVisible()
    await expect(dialog).not.toBeVisible()
  })

  test('opens the Receiving / Reconciliation modal for an incoming transfer', async ({ page }) => {
    await mockSiteTransfers(page, {
      outgoingBySourceSiteId: {},
      incomingByDestinationSiteId: { [SITE_BETA.id]: [TRANSFER_ALPHA_TO_BETA] },
    })
    await page.goto('/site-transfers')

    // Switch "My Site" to Site Beta (the transfer's destination) to see it as receivable.
    await page.getByLabel('My Site').selectOption({ label: SITE_BETA.name })
    await page.getByRole('button', { name: 'Incoming / Ready to Receive' }).click()

    await page.getByRole('button', { name: 'Receive', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Receive Shipment')).toBeVisible()
    await expect(dialog.getByText(MATERIAL_CEMENT.material_code)).toBeVisible()
    await expect(dialog.getByText('Remaining: 100')).toBeVisible()

    await dialog.getByLabel('Quantity received').fill('100')
    await dialog.getByRole('button', { name: 'Reconcile' }).click()

    await expect(page.getByText('Shipment reconciled successfully.')).toBeVisible()
    await expect(dialog).not.toBeVisible()
  })
})
