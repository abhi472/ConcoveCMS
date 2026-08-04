export interface TenantOption {
  id: string
  name: string
}

let currentTenantId = ''
let currentTenantName = ''

export let availableTenants: TenantOption[] = []

export function getCurrentTenantId() {
  return currentTenantId
}

export function setCurrentTenantId(nextTenantId: string) {
  currentTenantId = nextTenantId.trim()
}

export function setCurrentTenantName(nextTenantName: string) {
  currentTenantName = nextTenantName.trim()
}

export function setCurrentTenant(nextTenant: TenantOption | null) {
  if (!nextTenant) {
    currentTenantId = ''
    currentTenantName = ''
    availableTenants = []
    return
  }

  currentTenantId = nextTenant.id.trim()
  currentTenantName = nextTenant.name.trim()
  availableTenants = currentTenantId ? [{ id: currentTenantId, name: currentTenantName || 'Tenant' }] : []
}

export function getRequiredTenantId() {
  const tenantId = getCurrentTenantId()

  if (!tenantId) {
    throw new Error('Tenant context is not initialized.')
  }

  return tenantId
}

export function getTenantNameById(tenantId: string) {
  if (tenantId && tenantId === currentTenantId && currentTenantName) {
    return currentTenantName
  }
  const tenant = availableTenants.find((item) => item.id === tenantId)
  return tenant?.name ?? 'Unknown Tenant'
}