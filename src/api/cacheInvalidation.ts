import type { QueryClient } from '@tanstack/react-query'

export async function invalidateTenantLookupData(queryClient: QueryClient, tenantId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['master-data', tenantId] }),
    queryClient.invalidateQueries({ queryKey: ['materials', tenantId] }),
    queryClient.invalidateQueries({ queryKey: ['entities', tenantId] }),
    queryClient.invalidateQueries({ queryKey: ['site-materials', tenantId] }),
  ])
}

export async function invalidateTenantSummaryData(queryClient: QueryClient, tenantId: string, siteId?: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['inventory-dashboard', tenantId, siteId || 'all-sites'] }),
    queryClient.invalidateQueries({ queryKey: ['inventory-dashboard', tenantId] }),
    queryClient.invalidateQueries({ queryKey: ['analytics-overview', tenantId, siteId || 'all-sites'] }),
  ])
}

export async function invalidateTenantLookupAndSummaryData(queryClient: QueryClient, tenantId: string, siteId?: string) {
  await Promise.all([
    invalidateTenantLookupData(queryClient, tenantId),
    invalidateTenantSummaryData(queryClient, tenantId, siteId),
  ])
}