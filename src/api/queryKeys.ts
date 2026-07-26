export function masterDataQueryKey(tenantId: string, lastSyncedAt?: string) {
  return ['master-data', tenantId, lastSyncedAt ?? null] as const
}

export function inventoryDashboardQueryKey(tenantId: string, siteId?: string) {
  return ['inventory-dashboard', tenantId, siteId || 'all-sites'] as const
}

export function siteMaterialsQueryKey(tenantId: string, siteId?: string) {
  return ['site-materials', tenantId, siteId || 'all-sites'] as const
}