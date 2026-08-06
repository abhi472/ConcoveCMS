import axios from 'axios'
import axiosClient from './axiosClient'
import type { Material, UOM } from '../types/schema'

export interface ManagedMaterial extends Material {
  tenant_id: string
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface MaterialListParams {
  tenantId: string
  search?: string
  status?: 'active' | 'archived' | 'all'
  baseUomId?: string
  sort?: 'material_code' | 'description' | 'updated_at'
  direction?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface MaterialInput {
  materialCode: string
  description: string
  baseUomId: UOM
  issueUomId: UOM
  conversionFactor: number
}

export interface CsvImportResultRow {
  row_number: number
  sync_status: 'SUCCESS' | 'FAILED'
  reference: string
  message: string
}

export interface CsvImportResponse {
  results: CsvImportResultRow[]
}

interface MaterialListResponse {
  data: ManagedMaterial[]
  pagination: { page: number; page_size: number; total: number }
}

interface MaterialResponse {
  data: ManagedMaterial
}

interface MaterialErrorBody {
  message?: string
  blockers?: Array<{ code: 'ACTIVE_SITE_ASSIGNMENTS' | 'OPEN_PURCHASE_ORDERS'; count: number }>
}

export async function fetchMaterials(params: MaterialListParams) {
  const response = await axiosClient.get<MaterialListResponse>('/materials', {
    params: {
      tenant_id: params.tenantId,
      search: params.search,
      status: params.status,
      base_uom_id: params.baseUomId,
      sort: params.sort,
      direction: params.direction,
      page: params.page,
      page_size: params.pageSize,
    },
  })
  return response.data
}

function materialBody(tenantId: string, input: MaterialInput) {
  return {
    tenant_id: tenantId,
    material_code: input.materialCode,
    description: input.description,
    base_uom_id: input.baseUomId,
    issue_uom_id: input.issueUomId,
    conversion_factor: input.conversionFactor,
  }
}

export async function createMaterial(tenantId: string, input: MaterialInput) {
  const response = await axiosClient.post<MaterialResponse>('/materials', materialBody(tenantId, input))
  return response.data.data
}

export async function updateMaterial(tenantId: string, materialId: string, input: MaterialInput) {
  const response = await axiosClient.patch<MaterialResponse>(`/materials/${materialId}`, materialBody(tenantId, input))
  return response.data.data
}

export async function archiveMaterial(tenantId: string, materialId: string) {
  const response = await axiosClient.post<MaterialResponse>(`/materials/${materialId}/archive`, { tenant_id: tenantId })
  return response.data.data
}

export async function restoreMaterial(tenantId: string, materialId: string) {
  const response = await axiosClient.post<MaterialResponse>(`/materials/${materialId}/restore`, { tenant_id: tenantId })
  return response.data.data
}

export async function importMaterialsCsv(tenantId: string, csvContent: string) {
  const response = await axiosClient.post<CsvImportResponse>('/materials/csv', {
    tenant_id: tenantId,
    csv_content: csvContent,
  })
  return response.data
}

export function formatMaterialError(error: unknown) {
  if (!axios.isAxiosError<MaterialErrorBody>(error)) return 'The material could not be saved.'
  const data = error.response?.data
  if (error.response?.status === 409 && data?.blockers?.length) {
    return data.blockers.map((blocker) => blocker.code === 'ACTIVE_SITE_ASSIGNMENTS'
      ? `Unassign this material from ${blocker.count} active site${blocker.count === 1 ? '' : 's'} first.`
      : `Resolve ${blocker.count} open purchase order${blocker.count === 1 ? '' : 's'} first.`
    ).join(' ')
  }
  return data?.message ?? 'The material could not be saved.'
}