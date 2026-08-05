import { test, expect } from '@playwright/test'
import { installSafetyNetMocks, mockEquipment, mockMasterData } from './support/api-mocks'
import { SITE_ALPHA, SITE_BETA } from './support/fixtures'

// Note: EquipmentPage currently exposes search/status/site filters and an Add/Edit
// modal — there are no category tabs or a maintenance log modal in the shipped UI
// (MaintenanceLog only exists as a TS type with no wired-up component), so this
// suite covers the filtering and CRUD-modal workflows that actually exist.

const EXCAVATOR = {
  id: 'eq-1',
  tenant_id: 'test-tenant',
  name: 'Excavator 01',
  registration_number: 'EQ-EXC-001',
  make: 'Komatsu',
  model: 'PC200',
  current_site_id: SITE_ALPHA.id,
  status: 'ACTIVE',
}

const MIXER = {
  id: 'eq-2',
  tenant_id: 'test-tenant',
  name: 'Concrete Mixer',
  registration_number: 'EQ-MIX-002',
  make: 'Ashoka',
  model: 'CM500',
  current_site_id: SITE_BETA.id,
  status: 'IN_MAINTENANCE',
}

const EQUIPMENT_LIST = [EXCAVATOR, MIXER]

test.describe('Equipment registry workflows', () => {
  test.beforeEach(async ({ page }) => {
    await installSafetyNetMocks(page)
    await mockMasterData(page, { materials: [], entities: [SITE_ALPHA, SITE_BETA], purchase_orders: [] })
  })

  test('filters equipment by search term, status, and site', async ({ page }) => {
    await mockEquipment(page, EQUIPMENT_LIST)
    await page.goto('/equipment')

    await expect(page.getByText(EXCAVATOR.name)).toBeVisible()
    await expect(page.getByText(MIXER.name)).toBeVisible()

    await page.getByLabel('Search').fill('Excavator')
    await expect(page.getByText(EXCAVATOR.name)).toBeVisible()
    await expect(page.getByText(MIXER.name)).not.toBeVisible()
    await page.getByLabel('Search').fill('')

    await page.getByLabel('Status').selectOption('IN_MAINTENANCE')
    await expect(page.getByText(MIXER.name)).toBeVisible()
    await expect(page.getByText(EXCAVATOR.name)).not.toBeVisible()
    await page.getByLabel('Status').selectOption('all')

    await page.getByLabel('Site').selectOption({ label: SITE_ALPHA.name })
    await expect(page.getByText(EXCAVATOR.name)).toBeVisible()
    await expect(page.getByText(MIXER.name)).not.toBeVisible()
  })

  test('opens the Add Equipment modal and submits a new record', async ({ page }) => {
    await mockEquipment(page, EQUIPMENT_LIST)
    await page.goto('/equipment')

    await page.getByRole('button', { name: 'Add Equipment' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Add Equipment')).toBeVisible()

    const saveButton = dialog.getByRole('button', { name: 'Save Equipment' })
    await expect(saveButton).toBeDisabled()

    await dialog.getByLabel('Name').fill('Backhoe Loader')
    await dialog.getByLabel('Registration number').fill('EQ-BHL-003')
    await dialog.getByLabel('Make').fill('JCB')
    await dialog.getByLabel('Model').fill('3DX')

    await expect(saveButton).toBeEnabled()
    await saveButton.click()

    await expect(page.getByText('Backhoe Loader created.')).toBeVisible()
    await expect(dialog).not.toBeVisible()
  })

  test('opens the Edit Equipment modal prefilled with the selected row', async ({ page }) => {
    await mockEquipment(page, EQUIPMENT_LIST)
    await page.goto('/equipment')

    await page
      .getByRole('row', { name: new RegExp(EXCAVATOR.name) })
      .getByRole('button', { name: 'Edit' })
      .click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Edit Equipment')).toBeVisible()
    await expect(dialog.getByLabel('Name')).toHaveValue(EXCAVATOR.name)
    await expect(dialog.getByLabel('Registration number')).toHaveValue(EXCAVATOR.registration_number)
  })
})
