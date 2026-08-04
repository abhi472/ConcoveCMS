import axios from 'axios'
import axiosClient from './axiosClient'
import type { Equipment, EquipmentStatus } from '../types/schema'

export interface EquipmentListParams {
  tenantId: string
  siteId?: string
  status?: EquipmentStatus | 'all'
  search?: string
  page?: number
  pageSize?: number
}

export interface EquipmentInput {
  name: string
  registrationNumber: string
  make: string
  model: string
  currentSiteId?: string | null
  status?: EquipmentStatus
}

interface EquipmentListResponse {
  data: Equipment[]
  pagination: { page: number; page_size: number; total: number }
}

interface EquipmentResponse {
  data: Equipment
}

interface EquipmentErrorBody {
  message?: string
  code?: 'DUPLICATE_REGISTRATION_NUMBER'
  field?: string
}

export async function fetchEquipment(params: EquipmentListParams) {
  const response = await axiosClient.get<EquipmentListResponse>('/equipment', {
    params: {
      tenant_id: params.tenantId,
      site_id: params.siteId,
      status: params.status,
      search: params.search,
      page: params.page,
      page_size: params.pageSize,
    },
  })
  return response.data
}

function equipmentBody(tenantId: string, input: EquipmentInput) {
  return {
    tenant_id: tenantId,
    name: input.name,
    registration_number: input.registrationNumber,
    make: input.make,
    model: input.model,
    current_site_id: input.currentSiteId ?? null,
    status: input.status,
  }
}

export async function createEquipment(tenantId: string, input: EquipmentInput) {
  const response = await axiosClient.post<EquipmentResponse>('/equipment', equipmentBody(tenantId, input))
  return response.data.data
}

export async function updateEquipment(tenantId: string, equipmentId: string, input: EquipmentInput) {
  const response = await axiosClient.patch<EquipmentResponse>(`/equipment/${equipmentId}`, equipmentBody(tenantId, input))
  return response.data.data
}

export function formatEquipmentError(error: unknown) {
  if (!axios.isAxiosError<EquipmentErrorBody>(error)) return 'The equipment could not be saved.'
  const data = error.response?.data
  if (error.response?.status === 409 && data?.code === 'DUPLICATE_REGISTRATION_NUMBER') {
    return data.message ?? 'This tenant already has equipment registered with that registration number.'
  }
  return data?.message ?? 'The equipment could not be saved.'
}
