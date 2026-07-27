import axiosClient from './axiosClient'

export type AuditResourceType = 'MATERIAL' | 'ENTITY' | 'SITE_MATERIAL_ASSIGNMENT' | 'ENTITY_SITE_ASSOCIATION'
export type AuditAction = 'CREATE' | 'UPDATE' | 'ARCHIVE' | 'RESTORE' | 'ASSIGN' | 'UNASSIGN'

export interface AuditEvent {
  id: string
  tenant_id: string
  resource_type: AuditResourceType
  resource_id: string
  action: AuditAction
  actor_id: string
  before_state: Record<string, unknown> | null
  after_state: Record<string, unknown> | null
  created_at: string
}

interface AuditResponse {
  generated_at: string
  data: AuditEvent[]
  pagination: { page: number; page_size: number; total: number; has_next: boolean }
}

export async function fetchAuditEvents(params: {
  tenantId: string
  resourceType?: AuditResourceType | 'ALL'
  action?: AuditAction | 'ALL'
  resourceId?: string
  page?: number
  pageSize?: number
}) {
  const response = await axiosClient.get<AuditResponse>('/audit-events', {
    params: {
      tenant_id: params.tenantId,
      resource_type: params.resourceType === 'ALL' ? undefined : params.resourceType,
      action: params.action === 'ALL' ? undefined : params.action,
      resource_id: params.resourceId,
      page: params.page,
      page_size: params.pageSize,
    },
  })
  return response.data
}