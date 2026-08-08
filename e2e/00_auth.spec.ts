import { expect, test } from '@playwright/test'
import { installSafetyNetMocks } from './support/api-mocks'

test.describe('Authentication workflows', () => {
  test.beforeEach(async ({ page }) => {
    await installSafetyNetMocks(page)
    await page.addInitScript(() => {
      window.localStorage.removeItem('concove.auth.refresh')
    })
  })

  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/materials')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
  })

  test('logs in and opens the workspace', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@concove.test')
    await page.getByLabel('Password').fill('Password@123')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('Site scope')).toBeVisible()
  })

  test('clears session and returns to login on logout', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('concove.auth.refresh', 'test-refresh-token')
    })

    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible()

    await page.getByRole('button', { name: 'Logout' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('clears cached workspace data on logout', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('concove.auth.refresh', 'test-refresh-token')
    })

    let materialsRequests = 0
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/materials')) {
        materialsRequests += 1
      }
    })

    await page.goto('/materials')
    await expect(page.getByRole('heading', { level: 2, name: 'Material Catalog' })).toBeVisible()

    await page.getByRole('button', { name: 'Logout' }).click()
    await expect(page).toHaveURL(/\/login$/)

    await page.goto('/login')
    await page.getByLabel('Email').fill('admin@concove.test')
    await page.getByLabel('Password').fill('Password@123')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await page.goto('/materials')
    await expect(page.getByRole('heading', { level: 2, name: 'Material Catalog' })).toBeVisible()
    expect(materialsRequests).toBeGreaterThanOrEqual(2)
  })
})
