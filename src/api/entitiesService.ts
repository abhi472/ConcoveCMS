import axios from 'axios'
import axiosClient from './axiosClient'
import type { Entity, EntityType } from '../types/schema'

export interface ManagedEntity extends Entity {
  archived_at: string | null
  location_code: string | null
  address: string | null
  manager_name: string | null
  capacity_notes: string | null
  contact_name: string | null
  phone: string | null
  gst_number: string | null
  employee_code: string | null
  designation: string | null
  specialty: string | null
  registration_number: string | null
  created_at: string
  updated_at: string
}

export interface EntityInput {
  entityType: EntityType
  name: string
  locationCode: string
  address: string
  managerName: string
  capacityNotes: string
  contactName: string
  phone: string
  gstNumber: string
  employeeCode: string
  designation: string
  specialty: string
  registrationNumber: string
}

export interface EntitySiteAssociation {
  id: string
  tenant_id: string
  entity_id: string
  site_id: string
  site_name: string
  association_type: 'ASSIGNED' | 'PREFERRED'
  is_primary: boolean
  is_active: boolean
  ended_at: string | null
}

interface EntityListResponse {
  data: ManagedEntity[]
  pagination: { page: number; page_size: number; total: number }
}
interface EntityResponse { data: ManagedEntity }
interface AssociationListResponse { data: EntitySiteAssociation[] }
interface AssociationResponse { data: EntitySiteAssociation }
interface EntityErrorBody {
  message?: string
  blockers?: Array<{ code: string; count?: number }>
}

export async function fetchEntities(params: {
  tenantId: string
  search?: string
  entityType?: EntityType
  status?: 'active' | 'archived' | 'all'
  page?: number
  pageSize?: number
}) {
  const response = await axiosClient.get<EntityListResponse>('/entities', {
    params: {
      tenant_id: params.tenantId,
      search: params.search,
      entity_type: params.entityType,
      status: params.status,
      page: params.page,
      page_size: params.pageSize,
    },
  })
  return response.data
}

function entityBody(tenantId: string, input: EntityInput) {
  return {
    tenant_id: tenantId,
    entity_type: input.entityType,
    name: input.name,
    location_code: input.locationCode,
    address: input.address,
    manager_name: input.managerName,
    capacity_notes: input.capacityNotes,
    contact_name: input.contactName,
    phone: input.phone,
    gst_number: input.gstNumber,
    employee_code: input.employeeCode,
    designation: input.designation,
    specialty: input.specialty,
    registration_number: input.registrationNumber,
  }
}

export async function createEntity(tenantId: string, input: EntityInput) {
  const response = await axiosClient.post<EntityResponse>('/entities', entityBody(tenantId, input))
  return response.data.data
}

export async function updateEntity(tenantId: string, entityId: string, input: EntityInput) {
  const response = await axiosClient.patch<EntityResponse>(`/entities/${entityId}`, entityBody(tenantId, input))
  return response.data.data
}

export async function archiveEntity(tenantId: string, entityId: string) {
  const response = await axiosClient.post<EntityResponse>(`/entities/${entityId}/archive`, { tenant_id: tenantId })
  return response.data.data
}

export async function restoreEntity(tenantId: string, entityId: string) {
  const response = await axiosClient.post<EntityResponse>(`/entities/${entityId}/restore`, { tenant_id: tenantId })
  return response.data.data
}

export async function fetchEntitySites(tenantId: string, entityId: string) {
  const response = await axiosClient.get<AssociationListResponse>(`/entities/${entityId}/sites`, {
    params: { tenant_id: tenantId },
  })
  return response.data.data
}

export async function saveEntitySite(params: {
  tenantId: string
  entityId: string
  siteId: string
  isPrimary: boolean
}) {
  const response = await axiosClient.put<AssociationResponse>(
    `/entities/${params.entityId}/sites/${params.siteId}`,
    { tenant_id: params.tenantId, is_primary: params.isPrimary },
  )
  return response.data.data
}

export async function removeEntitySite(tenantId: string, entityId: string, siteId: string) {
  const response = await axiosClient.delete<AssociationResponse>(`/entities/${entityId}/sites/${siteId}`, {
    params: { tenant_id: tenantId },
  })
  return response.data.data
}

export function formatEntityError(error: unknown) {
  if (!axios.isAxiosError<EntityErrorBody>(error)) return 'The entity could not be saved.'
  const data = error.response?.data
  if (error.response?.status === 409 && data?.blockers?.length) {
    const labels: Record<string, string> = {
      NON_ZERO_STOCK: 'stocked material balances',
      OPEN_PURCHASE_ORDERS: 'open purchase orders',
      ACTIVE_SITE_ASSOCIATIONS: 'active site associations',
    }
    return data.blockers.map((blocker) => `${blocker.count ?? 0} ${labels[blocker.code] ?? blocker.code} must be resolved.`).join(' ')
  }
  return data?.message ?? 'The entity could not be saved.'
}