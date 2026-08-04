export function masterDataQueryKey(tenantId: string, lastSyncedAt?: string) {
  return ['master-data', tenantId, lastSyncedAt ?? null] as const
}

export function inventoryDashboardQueryKey(tenantId: string, siteId?: string) {
  return ['inventory-dashboard', tenantId, siteId || 'all-sites'] as const
}

export function inventoryBalancesQueryKey(tenantId: string, siteId?: string, materialId?: string) {
  return ['inventory-balances', tenantId, siteId || 'all-sites', materialId || 'all-materials'] as const
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

export function purchaseOrdersQueryKey(tenantId: string, filters?: object) {
  return filters
    ? ['purchase-orders', tenantId, filters] as const
    : ['purchase-orders', tenantId] as const
}

export function transactionsQueryKey(tenantId: string, filters?: object) {
  return ['transactions', tenantId, filters ?? {}] as const
}

export function auditEventsQueryKey(tenantId: string, filters?: object) {
  return ['audit-events', tenantId, filters ?? {}] as const
}

export function equipmentQueryKey(tenantId: string, filters?: object) {
  return ['equipment', tenantId, filters ?? {}] as const
}