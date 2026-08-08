import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { formatApiError } from '../api/errorUtils'
import { fetchInventoryDashboard } from '../api/inventoryService'
import { SUMMARY_STALE_TIME_MS } from '../api/cachePolicy'
import { inventoryDashboardQueryKey } from '../api/queryKeys'
import { useTenantContext } from '../context/useTenantContext'
import type { InventoryStatus } from '../types/inventory'

const statusStyles: Record<InventoryStatus, string> = {
  OK: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  LOW: 'border-amber-200 bg-amber-50 text-amber-800',
  CRITICAL: 'border-orange-200 bg-orange-50 text-orange-800',
  OUT_OF_STOCK: 'border-rose-200 bg-rose-50 text-rose-800',
}

const statusLabels: Record<InventoryStatus, string> = {
  OK: 'OK',
  LOW: 'Low',
  CRITICAL: 'Critical',
  OUT_OF_STOCK: 'Out of stock',
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedSiteId = searchParams.get('site') ?? ''
  const { selectedTenantId, selectedTenantName } = useTenantContext()
  const inventoryQuery = useQuery({
    queryKey: inventoryDashboardQueryKey(selectedTenantId, selectedSiteId),
    queryFn: () =>
      fetchInventoryDashboard({
        tenantId: selectedTenantId,
        siteId: selectedSiteId || undefined,
      }),
    staleTime: SUMMARY_STALE_TIME_MS,
  })

  const sites = inventoryQuery.data?.data.sites ?? []
  const directorySummaryItems = useMemo(
    () => {
      const entityCounts = new Map(
        (inventoryQuery.data?.data.entity_counts ?? []).map((item) => [item.entity_type, item.entity_count]),
      )
      const summaries = [
        { label: 'Sites', type: 'INTERNAL_SITE' as const, to: '/sites' },
        { label: 'Vendors', type: 'VENDOR' as const, to: '/vendors' },
        { label: 'Employees', type: 'EMPLOYEE' as const, to: '/employees' },
        { label: 'Subcontractors', type: 'SUBCONTRACTOR' as const, to: '/subcontractors' },
      ].map((item) => ({
        ...item,
        count: entityCounts.get(item.type) ?? 0,
      }))

      return summaries
    },
    [inventoryQuery.data],
  )
  const visibleSites = selectedSiteId
    ? sites.filter((site) => site.id === selectedSiteId)
    : sites
  const selectedSite = sites.find((site) => site.id === selectedSiteId)
  const inventory = inventoryQuery.data?.data
  const alerts = (inventory?.priority_risks ?? []).slice(0, 3)
  const siteSnapshots = useMemo(
    () => {
      const targetSites = visibleSites.length > 0 ? visibleSites : sites
      const siteSummaries = new Map(
        (inventory?.site_summaries ?? []).map((summary) => [summary.site_id, summary]),
      )
      return targetSites.slice(0, 4).map((site) => {
        const siteSummary = siteSummaries.get(site.id)
        return {
          site,
          materialCount: siteSummary?.material_count ?? 0,
          criticalCount: siteSummary?.critical_stock_count ?? 0,
          outOfStockCount: siteSummary?.out_of_stock_count ?? 0,
        }
      })
    },
    [inventory?.site_summaries, sites, visibleSites],
  )
  const pendingReceipts = (inventory?.pending_receipts ?? []).slice(0, 3)
  const recentMovements = (inventory?.recent_movements ?? []).slice(0, 3)

  useEffect(() => {
    const preferenceKey = `concove-dashboard-site:${selectedTenantId}`

    if (
      selectedSiteId &&
      !inventoryQuery.isLoading &&
      !sites.some((site) => site.id === selectedSiteId)
    ) {
      window.localStorage.removeItem(preferenceKey)
      setSearchParams({}, { replace: true })
      return
    }

    if (selectedSiteId && sites.some((site) => site.id === selectedSiteId)) {
      window.localStorage.setItem(preferenceKey, selectedSiteId)
      return
    }

    if (!selectedSiteId && !inventoryQuery.isLoading) {
      const preferredSiteId = window.localStorage.getItem(preferenceKey)
      if (preferredSiteId && sites.some((site) => site.id === preferredSiteId)) {
        setSearchParams({ site: preferredSiteId }, { replace: true })
      }
    }
  }, [inventoryQuery.isLoading, selectedSiteId, selectedTenantId, setSearchParams, sites])

  function handleSiteChange(siteId: string) {
    const preferenceKey = `concove-dashboard-site:${selectedTenantId}`
    if (siteId) {
      window.localStorage.setItem(preferenceKey, siteId)
    } else {
      window.localStorage.removeItem(preferenceKey)
    }

    setSearchParams(siteId ? { site: siteId } : {}, { replace: true })
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,20rem),1fr,auto] lg:items-end">
          <div className="min-w-0">
            <label htmlFor="site-select" className="mb-1 block text-sm font-medium text-slate-700">
              Site scope
            </label>
            {inventoryQuery.isLoading ? (
              <div className="h-8 w-full max-w-md animate-pulse rounded-md bg-slate-100" />
            ) : null}
            {inventoryQuery.isError ? (
              <ErrorState
                message={formatApiError(inventoryQuery.error, 'Failed to load dashboard overview.')}
                onRetry={() => inventoryQuery.refetch()}
              />
            ) : null}
            {!inventoryQuery.isLoading && !inventoryQuery.isError ? (
              <select
                id="site-select"
                className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none ring-slate-800 focus:ring-2"
                value={selectedSiteId}
                onChange={(event) => handleSiteChange(event.target.value)}
              >
                <option value="">All sites</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <p className="text-xs text-slate-500 lg:pb-2">
            {selectedSite?.name ?? 'All sites'} · {selectedTenantName}
          </p>

          <div className="flex items-center justify-between gap-2 lg:justify-end">
            {inventoryQuery.data ? (
              <span className="text-xs text-slate-500">
                Updated {formatTimestamp(inventoryQuery.data.generated_at)}
              </span>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              onClick={() => inventoryQuery.refetch()}
              disabled={inventoryQuery.isFetching}
            >
              {inventoryQuery.isFetching ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {inventoryQuery.isLoading ? <DashboardSkeleton /> : null}
      {inventoryQuery.isError ? (
        <ErrorState
          title="Live inventory is unavailable"
          message={formatApiError(
            inventoryQuery.error,
            'The inventory dashboard API could not be loaded.',
          )}
          onRetry={() => inventoryQuery.refetch()}
        />
      ) : null}

      {inventory ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Tracked materials" value={inventory.summary.material_count} />
            <Metric label="Low stock" value={inventory.summary.low_stock_count} tone="amber" />
            <Metric label="Critical" value={inventory.summary.critical_stock_count} tone="orange" />
            <Metric label="Out of stock" value={inventory.summary.out_of_stock_count} tone="rose" />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Directory summary</h3>
                <p className="mt-1 text-xs text-slate-500">Bounded counts for the type-specific workspace routes.</p>
              </div>
              <Link to="/sites" className="text-xs font-semibold text-slate-700 underline">
                Open directory
              </Link>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {directorySummaryItems.map((item) => (
                <Link key={item.label} to={item.to} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 transition hover:border-slate-300 hover:bg-white">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{item.count}</p>
                </Link>
              ))}
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Priority alerts</h3>
                  <p className="mt-1 text-xs text-slate-500">Immediate stock risks to handle first.</p>
                </div>
                <Link to="/operations" className="text-xs font-semibold text-slate-700 underline">
                  Open operations
                </Link>
              </div>
              <ul className="mt-3 space-y-2">
                {alerts.map((risk) => (
                  <li
                    key={`${risk.site_id}:${risk.material_id}`}
                    className={`rounded-md border px-3 py-2 ${statusStyles[risk.status]}`}
                  >
                    <div className="flex justify-between gap-2">
                      <p className="font-medium">{risk.material_code}</p>
                      <span className="text-xs font-semibold">{statusLabels[risk.status]}</span>
                    </div>
                    <p className="mt-1 text-xs">
                      {risk.site_name}: {formatQuantity(risk.quantity_base_uom)} {risk.base_uom_id}
                    </p>
                    <Link
                      className="mt-2 inline-block text-xs font-semibold underline"
                      to={`/operations?mode=ledger&site=${encodeURIComponent(risk.site_id)}&material=${encodeURIComponent(risk.material_id)}&type=INWARD`}
                    >
                      Fix now
                    </Link>
                  </li>
                ))}
                {alerts.length === 0 ? (
                  <li className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    No urgent stock issues right now.
                  </li>
                ) : null}
              </ul>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Pending receipts</h3>
                  <p className="mt-1 text-xs text-slate-500">PO lines still waiting to be received.</p>
                </div>
                <Link to="/operations?mode=purchase-orders" className="text-xs font-semibold text-slate-700 underline">
                  Open purchase orders
                </Link>
              </div>
              <ul className="mt-3 space-y-2">
                {pendingReceipts.map((receipt) => {
                  const openQty = Math.max(
                    0,
                    Number(receipt.ordered_quantity_base_uom) - Number(receipt.received_quantity_base_uom),
                  )
                  return (
                    <li key={`${receipt.po_id}:${receipt.material_id}`} className="rounded-md border border-slate-200 px-3 py-2">
                      <div className="flex justify-between gap-2">
                        <p className="font-medium text-slate-900">{receipt.po_number}</p>
                        <span className="text-xs font-semibold text-amber-700">Open {formatQuantity(openQty)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        {receipt.site_name} · {receipt.material_code} · due {receipt.expected_delivery_date}
                      </p>
                    </li>
                  )
                })}
                {pendingReceipts.length === 0 ? (
                  <li className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    No pending receipts in this scope.
                  </li>
                ) : null}
              </ul>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Recent movements</h3>
              <ul className="mt-3 space-y-2">
                {recentMovements.map((movement) => (
                  <li key={movement.transaction_id} className="rounded-md border border-slate-200 px-3 py-2">
                    <div className="flex justify-between gap-2">
                      <p className="font-medium text-slate-900">
                        {movement.transaction_type.replaceAll('_', ' ')} · {movement.material_code}
                      </p>
                      <span className="text-xs font-semibold text-slate-600">{formatQuantity(movement.quantity)}</span>
                    </div>
                    <p className="mt-1 text-xs">
                      {movement.site_name} · {formatTimestamp(movement.recorded_at)}
                    </p>
                  </li>
                ))}
                {recentMovements.length === 0 ? (
                  <li className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    No recent movements in this scope.
                  </li>
                ) : null}
              </ul>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Site health</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {siteSnapshots.map(({ site, materialCount, criticalCount, outOfStockCount }) => (
                  <article key={site.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{site.name}</p>
                    <p className="text-xs text-slate-500">{materialCount} tracked materials</p>
                    <p className="mt-1 text-xs text-orange-700">Critical: {criticalCount}</p>
                    <p className="text-xs text-rose-700">Out of stock: {outOfStockCount}</p>
                  </article>
                ))}
                {siteSnapshots.length === 0 ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    No site snapshots available in this scope.
                  </div>
                ) : null}
              </div>
            </section>

          </div>
        </>
      ) : null}
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Loading inventory">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-lg bg-slate-100" />
      ))}
    </div>
  )
}

function ErrorState({
  title = 'Unable to load data',
  message,
  onRetry,
}: {
  title?: string
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm">{message}</p>
      <button type="button" className="mt-2 text-sm font-semibold underline" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

function Metric({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: number
  tone?: 'slate' | 'amber' | 'orange' | 'rose'
}) {
  const tones = {
    slate: 'border-slate-200 text-slate-900',
    amber: 'border-amber-200 text-amber-800',
    orange: 'border-orange-200 text-orange-800',
    rose: 'border-rose-200 text-rose-800',
  }
  return (
    <div className={`rounded-lg border bg-white p-3 shadow-sm ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

export default Dashboard