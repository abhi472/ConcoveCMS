import { test, expect } from '@playwright/test'
import { bootstrapAuthenticatedSession, installSafetyNetMocks } from './support/api-mocks'

test.describe('RBAC direct-route denial', () => {
  test('admin can open users route directly', async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page, {
      user: {
        role: 'ADMIN',
        email: 'admin@concove.test',
        display_name: 'Admin User',
      },
    })

    await page.goto('/users')
    await expect(page.getByRole('heading', { level: 2, name: 'Users & Roles' })).toBeVisible()
  })

  test('site manager is denied on users route', async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page, {
      user: {
        role: 'SITE_MANAGER',
        email: 'manager@concove.test',
        display_name: 'Site Manager',
      },
    })

    await page.goto('/users')
    await expect(page.getByText('You do not have permission to access this workspace.')).toBeVisible()
  })

  test('operator is denied on users route', async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page, {
      user: {
        role: 'OPERATOR',
        email: 'operator@concove.test',
        display_name: 'Operator User',
      },
    })

    await page.goto('/users')
    await expect(page.getByText('You do not have permission to access this workspace.')).toBeVisible()
  })

  test('viewer is denied on users route', async ({ page }) => {
    await bootstrapAuthenticatedSession(page)
    await installSafetyNetMocks(page, {
      user: {
        role: 'VIEWER',
        email: 'viewer@concove.test',
        display_name: 'Viewer User',
      },
    })

    await page.goto('/users')
    await expect(page.getByText('You do not have permission to access this workspace.')).toBeVisible()
  })
})
