import axiosClient from './axiosClient'
import type { AnalyticsOverviewResponse } from '../types/analytics'

export interface FetchAnalyticsOverviewParams {
  tenantId: string
  siteId?: string
  days?: number
}

export async function fetchAnalyticsOverview({
  tenantId,
  siteId,
  days = 30,
}: FetchAnalyticsOverviewParams) {
  const response = await axiosClient.get<AnalyticsOverviewResponse>('/analytics/overview', {
    params: {
      tenant_id: tenantId,
      site_id: siteId || undefined,
      days,
    },
  })

  return response.data
}
