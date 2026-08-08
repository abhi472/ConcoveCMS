import { useQuery } from '@tanstack/react-query'
import { SUMMARY_STALE_TIME_MS } from './cachePolicy'
import { analyticsOverviewQueryKey } from './queryKeys'
import { fetchAnalyticsOverview } from './analyticsService'

interface UseAnalyticsOverviewQueryParams {
  tenantId: string
  siteId?: string
  days?: number
}

export function useAnalyticsOverviewQuery({
  tenantId,
  siteId,
  days = 30,
}: UseAnalyticsOverviewQueryParams) {
  return useQuery({
    queryKey: analyticsOverviewQueryKey(tenantId, siteId, days),
    queryFn: () => fetchAnalyticsOverview({ tenantId, siteId, days }),
    enabled: Boolean(tenantId),
    staleTime: SUMMARY_STALE_TIME_MS,
  })
}
