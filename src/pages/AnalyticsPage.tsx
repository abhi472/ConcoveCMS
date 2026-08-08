import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useAnalyticsOverviewQuery } from '../api/analyticsQueries'
import { LOOKUP_STALE_TIME_MS } from '../api/cachePolicy'
import { formatApiError } from '../api/errorUtils'
import { fetchMasterData } from '../api/masterDataService'
import { masterDataQueryKey } from '../api/queryKeys'
import { MaterialUsageWidget } from '../components/analytics/widgets/MaterialUsageWidget'
import { POAllocationWidget } from '../components/analytics/widgets/POAllocationWidget'
import { UnitVelocitySparkWidget } from '../components/analytics/widgets/UnitVelocitySparkWidget'
import { useTenantContext } from '../context/useTenantContext'

const RANGE_OPTIONS = [7, 14, 30, 60, 90]

function parseRangeDays(rawValue: string | null): number {
  const parsed = Number(rawValue)
  if (!Number.isInteger(parsed)) return 30
  if (!RANGE_OPTIONS.includes(parsed)) return 30
  return parsed
}

function formatGeneratedAt(value?: string) {
  if (!value) return 'Waiting for first sync'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Waiting for first sync'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatInsightNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)
}

function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { selectedTenantId } = useTenantContext()
  const siteId = searchParams.get('site') ?? undefined
  const rangeDays = parseRangeDays(searchParams.get('days'))

  const masterDataQuery = useQuery({
    queryKey: masterDataQueryKey(selectedTenantId),
    queryFn: () => fetchMasterData({ tenantId: selectedTenantId }),
    staleTime: LOOKUP_STALE_TIME_MS,
    placeholderData: (previousData) => previousData,
  })
  const sites = useMemo(
    () =>
      masterDataQuery.data?.data.entities.filter(
        (entity) => entity.entity_type === 'INTERNAL_SITE',
      ) ?? [],
    [masterDataQuery.data],
  )
  const selectedSite = sites.find((site) => site.id === siteId)

  const overviewQuery = useAnalyticsOverviewQuery({
    tenantId: selectedTenantId,
    siteId,
    days: rangeDays,
  })

  const overview = overviewQuery.data?.data

  const insights = useMemo(() => {
    const usage = overview?.material_usage ?? []
    const allocation = overview?.po_allocation ?? []

    const splitIndex = Math.max(1, Math.floor(usage.length / 2))
    const recentSlice = usage.slice(splitIndex)
    const earlierSlice = usage.slice(0, splitIndex)

    const sumOutward = (rows: typeof usage) =>
      rows.reduce((acc, row) => acc + Number(row.OUTWARD ?? 0), 0)

    const recentOutward = sumOutward(recentSlice)
    const previousOutward = sumOutward(earlierSlice)
    const outwardDeltaPercent = previousOutward > 0
      ? ((recentOutward - previousOutward) / previousOutward) * 100
      : 0

    const topGap = allocation.reduce<{ material: string; gap: number } | null>((best, row) => {
      const allocated = Number(row.Allocated ?? 0)
      const fulfilled = Number(row.Fulfilled ?? 0)
      const gap = Math.max(allocated - fulfilled, 0)
      if (!best || gap > best.gap) return { material: String(row.date), gap }
      return best
    }, null)

    const summary = overview?.summary
    const spend = summary?.projected_spend_month ?? 0
    const throughput = (summary?.seven_day_inward_units ?? 0) - (summary?.seven_day_outward_units ?? 0)

    return {
      outwardDeltaPercent,
      topGap,
      spend,
      throughput,
    }
  }, [overview])

  function updateFilters(next: { site?: string; days?: number }) {
    const nextSite = next.site === undefined ? siteId : next.site
    const nextDays = next.days === undefined ? rangeDays : next.days

    const params = new URLSearchParams(searchParams)

    if (nextSite) params.set('site', nextSite)
    else params.delete('site')

    params.set('days', String(nextDays))
    setSearchParams(params, { replace: true })
  }

  return (
    <section className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,20rem),1fr,auto] lg:items-end">
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Site scope
            </span>
            <select
              value={siteId ?? ''}
              onChange={(event) => updateFilters({ site: event.target.value || undefined })}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-800 focus:ring-2"
            >
              <option value="">All sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </label>

          <div className="min-w-0">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Time range
            </span>
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => updateFilters({ days })}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                    days === rangeDays
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {days}D
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <span className="text-xs text-slate-500">
              {selectedSite?.name ?? 'All internal sites'} · Updated {formatGeneratedAt(overviewQuery.data?.generated_at)}
            </span>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              onClick={() => overviewQuery.refetch()}
              disabled={overviewQuery.isFetching}
            >
              {overviewQuery.isFetching ? 'Refreshing...' : 'Refresh analytics'}
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Consumption Momentum</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {insights.outwardDeltaPercent >= 0 ? '+' : ''}{insights.outwardDeltaPercent.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500">Outward volume change across the selected window halves.</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Largest Fulfillment Gap</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {insights.topGap ? insights.topGap.material : 'No gaps'}
          </p>
          <p className="text-xs text-slate-500">
            {insights.topGap ? `${formatInsightNumber(insights.topGap.gap)} units open` : 'All tracked materials are balanced.'}
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Monthly Spend Signal</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">INR {formatInsightNumber(insights.spend)}</p>
          <p className="text-xs text-slate-500">Projected from recorded commercial transaction values.</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">7D Throughput Balance</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {insights.throughput >= 0 ? '+' : ''}{formatInsightNumber(insights.throughput)} units
          </p>
          <p className="text-xs text-slate-500">Net inward minus outward over the latest seven days.</p>
        </article>
      </section>

      {overviewQuery.isError ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">
          <p className="font-semibold">Analytics overview is unavailable</p>
          <p className="mt-1 text-sm">
            {formatApiError(overviewQuery.error, 'Failed to load analytics overview.')}
          </p>
          <button
            type="button"
            className="mt-2 text-sm font-semibold underline"
            onClick={() => overviewQuery.refetch()}
          >
            Retry
          </button>
        </div>
      ) : null}

      <UnitVelocitySparkWidget summary={overview?.summary} isLoading={overviewQuery.isLoading} />

      <div className="grid gap-4 xl:grid-cols-2">
        <MaterialUsageWidget
          siteLabel={selectedSite?.name}
          data={overview?.material_usage}
          isLoading={overviewQuery.isLoading}
        />
        <POAllocationWidget data={overview?.po_allocation} isLoading={overviewQuery.isLoading} />
      </div>
    </section>
  )
}

export default AnalyticsPage
