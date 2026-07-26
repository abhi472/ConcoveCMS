import axiosClient from './axiosClient'
import type { InventoryDashboardResponse } from '../types/inventory'

export interface FetchInventoryDashboardParams {
  tenantId: string
  siteId?: string
}

export async function fetchInventoryDashboard({
  tenantId,
  siteId,
}: FetchInventoryDashboardParams) {
  const response = await axiosClient.get<InventoryDashboardResponse>('/inventory/dashboard', {
    params: {
      tenant_id: tenantId,
      site_id: siteId || undefined,
    },
  })

  return response.data
}