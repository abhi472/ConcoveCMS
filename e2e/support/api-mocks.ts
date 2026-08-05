import type { Page, Route } from '@playwright/test'

const TEST_ACCESS_TOKEN = 'test-access-token'
const TEST_REFRESH_TOKEN = 'test-refresh-token'
export const TEST_USER = {
  user_id: '11111111-1111-1111-1111-111111111111',
  tenant_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  tenant_name: 'Badri Rai Construction',
  role: 'ADMIN',
  email: 'admin@concove.test',
  display_name: 'Admin User',
}

type MockUser = typeof TEST_USER

interface Pagination {
  page: number
  page_size: number
  total: number
}

function listBody<T>(items: T[]): { data: T[]; pagination: Pagination } {
  return { data: items, pagination: { page: 1, page_size: 200, total: items.length } }
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

/**
 * Registers a catch-all handler for every /api/v1 call. Must be installed before any
 * other mock in a test so the dev server's proxy to the live Render backend is never
 * reached, even for endpoints a test forgets to mock explicitly.
 */
export async function installSafetyNetMocks(page: Page, options?: { user?: Partial<MockUser> }) {
  const mockUser: MockUser = {
    ...TEST_USER,
    ...options?.user,
  }

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const method = request.method()
    const pathname = new URL(request.url()).pathname

    if (pathname.endsWith('/auth/login') && method === 'POST') {
      await fulfillJson(route, {
        access_token: TEST_ACCESS_TOKEN,
        refresh_token: TEST_REFRESH_TOKEN,
        user: mockUser,
      })
      return
    }

    if (pathname.endsWith('/auth/refresh') && method === 'POST') {
      await fulfillJson(route, {
        access_token: TEST_ACCESS_TOKEN,
        refresh_token: TEST_REFRESH_TOKEN,
      })
      return
    }

    if (pathname.endsWith('/auth/logout') && method === 'POST') {
      await fulfillJson(route, { success: true })
      return
    }

    if (pathname.endsWith('/auth/me') && method === 'GET') {
      await fulfillJson(route, mockUser)
      return
    }

    if (method !== 'GET') {
      await fulfillJson(route, { data: {} })
      return
    }

    // The Dashboard route always fetches this and formats `generated_at` as a date,
    // so the safety net needs a well-shaped payload rather than a bare empty list.
    if (pathname.endsWith('/inventory/dashboard')) {
      await fulfillJson(route, {
        generated_at: new Date().toISOString(),
        data: { summary: { material_count: 0, low_stock_count: 0, critical_stock_count: 0, out_of_stock_count: 0 }, balances: [], pending_receipts: [], recent_movements: [] },
      })
      return
    }

    if (pathname.endsWith('/sync/master-data')) {
      await fulfillJson(route, {
        sync_timestamp: new Date().toISOString(),
        data: { materials: [], entities: [], purchase_orders: [] },
      })
      return
    }

    await fulfillJson(route, listBody([]))
  })
}

export async function bootstrapAuthenticatedSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('concove.auth.refresh', 'test-refresh-token')
  })
}

export async function mockMasterData(
  page: Page,
  data: { materials: unknown[]; entities: unknown[]; purchase_orders: unknown[] },
) {
  await page.route('**/api/v1/sync/master-data**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await fulfillJson(route, { sync_timestamp: new Date().toISOString(), data })
  })
}

export async function mockEntities(page: Page, entities: unknown[]) {
  await page.route('**/api/v1/entities**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await fulfillJson(route, listBody(entities))
  })
}

export async function mockMaterials(
  page: Page,
  materials: Array<{ material_code: string; description: string }>,
) {
  await page.route('**/api/v1/materials**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const url = new URL(route.request().url())
    const search = (url.searchParams.get('search') ?? '').toLowerCase()
    const filtered = search
      ? materials.filter(
          (material) =>
            material.material_code.toLowerCase().includes(search) ||
            material.description.toLowerCase().includes(search),
        )
      : materials
    await fulfillJson(route, listBody(filtered))
  })
}

export async function mockInventoryBalances(page: Page, balances: unknown[]) {
  await page.route('**/api/v1/inventory/balances**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await fulfillJson(route, { generated_at: new Date().toISOString(), data: balances })
  })
}

export async function mockTransactionsBatch(page: Page, response: unknown) {
  await page.route('**/api/v1/sync/transactions/batch**', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    await fulfillJson(route, response)
  })
}

export async function mockAnalyticsOverview(page: Page, overview: unknown) {
  await page.route('**/api/v1/analytics/overview**', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    await fulfillJson(route, overview)
  })
}

interface EquipmentFixture {
  id: string
  name: string
  registration_number: string
  status: string
  current_site_id: string | null
}

export async function mockEquipment(page: Page, equipment: EquipmentFixture[]) {
  await page.route('**/api/v1/equipment**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const isItemRoute = /\/equipment\/[^/?]+$/.test(url.pathname)

    if (request.method() === 'GET' && !isItemRoute) {
      const search = (url.searchParams.get('search') ?? '').toLowerCase()
      const status = url.searchParams.get('status')
      const siteId = url.searchParams.get('site_id')
      let filtered = equipment
      if (search) {
        filtered = filtered.filter(
          (item) =>
            item.name.toLowerCase().includes(search) ||
            item.registration_number.toLowerCase().includes(search),
        )
      }
      if (status && status !== 'all') {
        filtered = filtered.filter((item) => item.status === status)
      }
      if (siteId) {
        filtered = filtered.filter((item) => item.current_site_id === siteId)
      }
      await fulfillJson(route, listBody(filtered))
      return
    }

    if (request.method() === 'POST' && !isItemRoute) {
      const payload = request.postDataJSON() as Record<string, unknown>
      await fulfillJson(route, { data: { id: 'equipment-new', tenant_id: 'test-tenant', ...payload } })
      return
    }

    if (request.method() === 'PATCH' && isItemRoute) {
      const payload = request.postDataJSON() as Record<string, unknown>
      const equipmentId = url.pathname.split('/').pop()
      await fulfillJson(route, { data: { id: equipmentId, tenant_id: 'test-tenant', ...payload } })
      return
    }

    await route.fallback()
  })
}

interface PurchaseOrderMockOptions {
  list: unknown[]
  bulkApproveStatusById?: Record<string, 'SYNCED' | 'FAILED'>
}

export async function mockPurchaseOrders(page: Page, options: PurchaseOrderMockOptions) {
  await page.route('**/api/v1/purchase-orders**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const isBulkApprove = url.pathname.endsWith('/bulk-approve')
    const isStatusRoute = url.pathname.endsWith('/status')
    const isItemRoute = !isBulkApprove && !isStatusRoute && /\/purchase-orders\/[^/?]+$/.test(url.pathname)

    if (request.method() === 'GET' && !isItemRoute) {
      await fulfillJson(route, listBody(options.list))
      return
    }

    if (request.method() === 'PATCH' && isBulkApprove) {
      const payload = request.postDataJSON() as { po_ids: string[] }
      const results = payload.po_ids.map((purchaseOrderId) => {
        const syncStatus = options.bulkApproveStatusById?.[purchaseOrderId] ?? 'SYNCED'
        return {
          purchase_order_id: purchaseOrderId,
          sync_status: syncStatus,
          message: syncStatus === 'SYNCED' ? 'Approved.' : 'Approval failed.',
        }
      })
      await fulfillJson(route, { results })
      return
    }

    await route.fallback()
  })
}

interface SiteTransferMockOptions {
  outgoingBySourceSiteId: Record<string, unknown[]>
  incomingByDestinationSiteId: Record<string, unknown[]>
}

export async function mockSiteTransfers(page: Page, options: SiteTransferMockOptions) {
  await page.route('**/api/v1/site-transfers**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const isReceiveRoute = url.pathname.endsWith('/receive')

    if (request.method() === 'GET' && !isReceiveRoute) {
      const sourceSiteId = url.searchParams.get('source_site_id')
      const destinationSiteId = url.searchParams.get('destination_site_id')
      const items = sourceSiteId
        ? (options.outgoingBySourceSiteId[sourceSiteId] ?? [])
        : destinationSiteId
          ? (options.incomingByDestinationSiteId[destinationSiteId] ?? [])
          : []
      await fulfillJson(route, listBody(items))
      return
    }

    if (request.method() === 'POST' && !isReceiveRoute) {
      const payload = request.postDataJSON() as Record<string, unknown>
      await fulfillJson(route, {
        data: {
          id: 'transfer-new',
          tenant_id: 'test-tenant',
          transfer_status: 'DISPATCHED',
          source_site_name: 'Site Alpha',
          destination_site_name: 'Site Beta',
          ...payload,
        },
      })
      return
    }

    if (request.method() === 'PATCH' && isReceiveRoute) {
      const payload = request.postDataJSON() as Record<string, unknown>
      const segments = url.pathname.split('/')
      const siteTransferId = segments[segments.length - 2]
      await fulfillJson(route, {
        data: { id: siteTransferId, transfer_status: 'RECONCILED', ...payload },
      })
      return
    }

    await route.fallback()
  })
}
