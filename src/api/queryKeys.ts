export function masterDataQueryKey(tenantId: string, lastSyncedAt?: string) {
  return ['master-data', tenantId, lastSyncedAt ?? null] as const
}

export function inventoryDashboardQueryKey(tenantId: string, siteId?: string) {
  return ['inventory-dashboard', tenantId, siteId || 'all-sites'] as const
}

export function siteMaterialsQueryKey(tenantId: string, siteId?: string) {
  return ['site-materials', tenantId, siteId || 'all-sites'] as const
}

export function materialsQueryKey(tenantId: string, filters?: object) {
  return ['materials', tenantId, filters ?? {}] as const
}

export function entitiesQueryKey(tenantId: string, filters?: object) {
  return ['entities', tenantId, filters ?? {}] as const
}

export function entitySitesQueryKey(tenantId: string, entityId: string) {
  return ['entity-sites', tenantId, entityId] as const
}

export function purchaseOrdersQueryKey(tenantId: string) {
  return ['purchase-orders', tenantId] as const
}