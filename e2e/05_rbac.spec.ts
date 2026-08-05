import { test, expect } from '@playwright/test'
import { bootstrapAuthenticatedSession, installSafetyNetMocks } from './support/api-mocks'

test.describe('RBAC workspace gating', () => {
  test('admin can navigate to users administration page', async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page, {
      user: {
        role: 'ADMIN',
        email: 'admin@concove.test',
        display_name: 'Admin User',
      },
    })

    await page.goto('/')

    await expect(page.getByText('Role: ADMIN')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Users' })).toBeVisible()

    await page.getByRole('link', { name: 'Users' }).click()
    await expect(page.getByRole('heading', { level: 2, name: 'Users & Roles' })).toBeVisible()
    await expect(page.getByText('Admin-controlled tenant user access and role assignment.')).toBeVisible()
  })

  test('viewer cannot access admin navigation or users page route', async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page, {
      user: {
        role: 'VIEWER',
        email: 'viewer@concove.test',
        display_name: 'Viewer User',
      },
    })

    await page.goto('/')

    await expect(page.getByText('Role: VIEWER')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Entities' })).toHaveCount(0)

    await page.goto('/users')
    await expect(page.getByText('You do not have permission to access this workspace.')).toBeVisible()
  })

  test('viewer sees read-only mutation controls across key modules', async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page, {
      user: {
        role: 'VIEWER',
        email: 'viewer@concove.test',
        display_name: 'Viewer User',
      },
    })

    await page.goto('/materials')
    await expect(page.getByText('Your role has read-only access for material catalog data.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Material' })).toBeDisabled()

    await page.goto('/operations')
    await expect(page.getByText('Your role has read-only access for procurement drafts.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save Draft' })).toBeDisabled()

    await page.getByRole('button', { name: 'Ledger Adjustment' }).click()
    await expect(page.getByText('Your role has read-only access for ledger and fluid actions.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Commit to Ledger' })).toBeDisabled()
  })

  test('site manager can manage materials and entities but cannot access users admin', async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page, {
      user: {
        role: 'SITE_MANAGER',
        email: 'manager@concove.test',
        display_name: 'Site Manager',
      },
    })

    await page.goto('/')
    await expect(page.getByText('Role: SITE_MANAGER')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Entities' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0)

    await page.goto('/materials')
    await expect(page.getByRole('button', { name: 'Add Material' })).toBeEnabled()

    await page.goto('/entities')
    await expect(page.getByRole('button', { name: 'Add Site' })).toBeEnabled()

    await page.goto('/users')
    await expect(page.getByText('You do not have permission to access this workspace.')).toBeVisible()
  })

  test('operator has operational mutations but no admin or manager-only controls', async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page, {
      user: {
        role: 'OPERATOR',
        email: 'operator@concove.test',
        display_name: 'Operator User',
      },
    })

    await page.goto('/')
    await expect(page.getByText('Role: OPERATOR')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Entities' })).toHaveCount(0)

    await page.goto('/materials')
    await expect(page.getByText('Your role has read-only access for material catalog data.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Material' })).toBeDisabled()

    await page.goto('/equipment')
    await expect(page.getByRole('button', { name: 'Add Equipment' })).toBeEnabled()

    await page.goto('/operations')
    await expect(page.getByRole('button', { name: 'Save Draft' })).toBeEnabled()
    await page.getByRole('button', { name: 'Ledger Adjustment' }).click()
    await expect(page.getByRole('button', { name: 'Commit to Ledger' })).toBeEnabled()
  })
})
