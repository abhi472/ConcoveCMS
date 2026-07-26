import axios from 'axios'
import axiosClient from './axiosClient'

export interface SiteMaterialAssignment {
  site_id: string
  site_name: string
  material_id: string
  material_code: string
  material_description: string
  base_uom_id: string
  low_stock_threshold: string
  critical_stock_threshold: string
  is_active: boolean
  deactivated_at: string | null
  updated_at: string
}

interface SiteMaterialListResponse {
  data: SiteMaterialAssignment[]
}

interface SiteMaterialMutationResponse {
  data: SiteMaterialAssignment
}

interface AssignmentBlocker {
  code: 'NON_ZERO_STOCK' | 'OPEN_PURCHASE_ORDERS'
  quantity_base_uom?: number
  count?: number
}

interface AssignmentErrorResponse {
  message?: string
  blockers?: AssignmentBlocker[]
}

export async function fetchSiteMaterials(tenantId: string, siteId?: string) {
  const response = await axiosClient.get<SiteMaterialListResponse>('/inventory/site-materials', {
    params: { tenant_id: tenantId, site_id: siteId },
  })
  return response.data.data
}

export async function saveSiteMaterialAssignment(params: {
  tenantId: string
  siteId: string
  materialId: string
  lowStockThreshold: number
  criticalStockThreshold: number
}) {
  const response = await axiosClient.put<SiteMaterialMutationResponse>(
    `/inventory/sites/${params.siteId}/materials/${params.materialId}`,
    {
      tenant_id: params.tenantId,
      low_stock_threshold: params.lowStockThreshold,
      critical_stock_threshold: params.criticalStockThreshold,
    },
  )
  return response.data.data
}

export async function removeSiteMaterialAssignment(params: {
  tenantId: string
  siteId: string
  materialId: string
}) {
  const response = await axiosClient.delete<SiteMaterialMutationResponse>(
    `/inventory/sites/${params.siteId}/materials/${params.materialId}`,
    { params: { tenant_id: params.tenantId } },
  )
  return response.data.data
}

export function formatAssignmentError(error: unknown) {
  if (!axios.isAxiosError<AssignmentErrorResponse>(error)) {
    return 'The assignment could not be updated.'
  }

  const data = error.response?.data
  if (error.response?.status === 409 && data?.blockers?.length) {
    return data.blockers.map((blocker) => {
      if (blocker.code === 'NON_ZERO_STOCK') {
        return `Stock balance must be zero. Current balance: ${blocker.quantity_base_uom ?? 0}.`
      }
      return `${blocker.count ?? 0} open purchase order${blocker.count === 1 ? '' : 's'} must be resolved.`
    }).join(' ')
  }

  return data?.message ?? 'The assignment could not be updated.'
}