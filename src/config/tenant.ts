export interface TenantOption {
  id: string
  name: string
}

const defaultTenant: TenantOption = {
  id: import.meta.env.VITE_TENANT_ID ?? '',
  name: import.meta.env.VITE_TENANT_NAME ?? 'Badri Rai Construction',
}

let currentTenantId = defaultTenant.id

export const availableTenants: TenantOption[] = [defaultTenant].filter(
  (tenant) => tenant.id !== '',
)

export function getCurrentTenantId() {
  return currentTenantId
}

export function setCurrentTenantId(nextTenantId: string) {
  currentTenantId = nextTenantId
}

export function getRequiredTenantId() {
  const tenantId = getCurrentTenantId()

  if (!tenantId) {
    throw new Error('VITE_TENANT_ID is not configured.')
  }

  return tenantId
}

export function getTenantNameById(tenantId: string) {
  const tenant = availableTenants.find((item) => item.id === tenantId)
  return tenant?.name ?? 'Unknown Tenant'
}