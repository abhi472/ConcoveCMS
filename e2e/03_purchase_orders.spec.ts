import { test, expect } from '@playwright/test'
import { bootstrapAuthenticatedSession, installSafetyNetMocks, mockMasterData, mockPurchaseOrders } from './support/api-mocks'
import { SITE_ALPHA, VENDOR_ACME } from './support/fixtures'

const PO_PENDING = {
  id: 'po-1001',
  po_number: 'PO-1001',
  vendor_id: VENDOR_ACME.id,
  vendor_name: VENDOR_ACME.name,
  target_site_id: SITE_ALPHA.id,
  target_site_name: SITE_ALPHA.name,
  status: 'DRAFT',
  po_status: 'PENDING_APPROVAL',
  expected_delivery_date: null,
  line_count: 1,
  ordered_quantity_base_uom: 500,
  received_quantity_base_uom: 0,
  open_quantity_base_uom: 500,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const PO_DRAFT = {
  ...PO_PENDING,
  id: 'po-1002',
  po_number: 'PO-1002',
  po_status: 'DRAFT',
  ordered_quantity_base_uom: 200,
  open_quantity_base_uom: 200,
}

const PO_APPROVED = {
  ...PO_PENDING,
  id: 'po-1003',
  po_number: 'PO-1003',
  status: 'APPROVED',
  po_status: 'APPROVED',
  ordered_quantity_base_uom: 300,
  received_quantity_base_uom: 100,
  open_quantity_base_uom: 200,
  line_count: 2,
}

const PURCHASE_ORDERS = [PO_PENDING, PO_DRAFT, PO_APPROVED]

test.describe('Purchase order approval workflows', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page)
    await mockMasterData(page, {
      materials: [],
      entities: [SITE_ALPHA, VENDOR_ACME],
      purchase_orders: [],
    })
  })

  test('renders PO status badges for each approval state', async ({ page }) => {
    await mockPurchaseOrders(page, { list: PURCHASE_ORDERS })
    await page.goto('/operations')

    const pendingRow = page.getByRole('row', { name: new RegExp(PO_PENDING.po_number) })
    const draftRow = page.getByRole('row', { name: new RegExp(PO_DRAFT.po_number) })
    const approvedRow = page.getByRole('row', { name: new RegExp(PO_APPROVED.po_number) })

    await expect(pendingRow.getByText('Pending Approval', { exact: true })).toBeVisible()
    await expect(draftRow.getByText('Draft', { exact: true })).toBeVisible()
    await expect(approvedRow.getByText('Approved', { exact: true })).toBeVisible()
  })

  test('only allows selecting PENDING_APPROVAL rows for bulk approval', async ({ page }) => {
    await mockPurchaseOrders(page, { list: PURCHASE_ORDERS })
    await page.goto('/operations')

    const pendingCheckbox = page.getByRole('checkbox', { name: `Select ${PO_PENDING.po_number} for bulk approval` })
    const draftCheckbox = page.getByRole('checkbox', { name: `Select ${PO_DRAFT.po_number} for bulk approval` })
    const approvedCheckbox = page.getByRole('checkbox', { name: `Select ${PO_APPROVED.po_number} for bulk approval` })

    await expect(pendingCheckbox).toBeEnabled()
    await expect(draftCheckbox).toBeDisabled()
    await expect(approvedCheckbox).toBeDisabled()

    await pendingCheckbox.check()
    await expect(pendingCheckbox).toBeChecked()
  })

  test('activates the floating bulk action bar once a row is selected', async ({ page }) => {
    await mockPurchaseOrders(page, { list: PURCHASE_ORDERS })
    await page.goto('/operations')

    await expect(page.getByText('purchase order selected')).toHaveCount(0)

    await page.getByRole('checkbox', { name: `Select ${PO_PENDING.po_number} for bulk approval` }).check()

    await expect(page.getByText('1 purchase order selected')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve Selected' })).toBeVisible()
  })

  test('submits a bulk approval and reports success', async ({ page }) => {
    await mockPurchaseOrders(page, {
      list: PURCHASE_ORDERS,
      bulkApproveStatusById: { [PO_PENDING.id]: 'SYNCED' },
    })
    await page.goto('/operations')

    await page.getByRole('checkbox', { name: `Select ${PO_PENDING.po_number} for bulk approval` }).check()
    await page.getByRole('button', { name: 'Approve Selected' }).click()

    await expect(page.getByText('Approved 1 purchase order.')).toBeVisible()
    await expect(page.getByText('1 purchase order selected')).toHaveCount(0)
  })
})
