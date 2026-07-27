import axiosClient from './axiosClient'
import type { InventoryDashboardResponse } from '../types/inventory'

export type InventoryStatus = 'OK' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK'

export interface InventoryBalance {
  site_id: string
  material_id: string
  material_code: string
  material_description: string
  base_uom_id: string
  quantity_base_uom: number
  low_stock_threshold: string
  critical_stock_threshold: string
  status: InventoryStatus
  updated_at: string
}

export async function fetchInventoryBalances(params: {
  tenantId: string
  siteId?: string
  materialId?: string
}) {
  const response = await axiosClient.get<{ generated_at: string; data: InventoryBalance[] }>('/inventory/balances', {
    params: { tenant_id: params.tenantId, site_id: params.siteId, material_id: params.materialId },
  })
  return response.data
}

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