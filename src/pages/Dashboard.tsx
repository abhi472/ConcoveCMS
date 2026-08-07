import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { formatApiError } from '../api/errorUtils'
import { fetchInventoryDashboard } from '../api/inventoryService'
import { fetchMasterData } from '../api/masterDataService'
import { inventoryDashboardQueryKey, masterDataQueryKey } from '../api/queryKeys'
import { useTenantContext } from '../context/useTenantContext'
import type { InventoryBalance, InventoryStatus } from '../types/inventory'

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

function BalanceCell({
  balance,
  siteId,
  materialId,
}: {
  balance?: InventoryBalance
  siteId: string
  materialId: string
}) {
  if (!balance) return <span className="text-xs text-slate-400">No balance</span>

  const transactionType = balance.status === 'OK' ? 'OUTWARD' : 'INWARD'
  const actionLabel = balance.status === 'OK' ? 'Record issue' : 'Record receipt'

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div
        className={`inline-flex min-w-24 flex-col rounded-md border px-2 py-1 ${statusStyles[balance.status]}`}
        title={`Updated ${formatTimestamp(balance.updated_at)}`}
      >
        <span className="text-xs font-semibold">
          {formatQuantity(balance.quantity_base_uom)} {balance.base_uom_id}
        </span>
        <span className="text-xs">{statusLabels[balance.status]}</span>
      </div>
      <Link
        className="text-xs font-semibold text-slate-700 underline hover:text-slate-950"
        to={`/operations?mode=ledger&site=${encodeURIComponent(siteId)}&material=${encodeURIComponent(materialId)}&type=${transactionType}`}
      >
        {actionLabel}
      </Link>
    </div>
  )
}

function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedSiteId = searchParams.get('site') ?? ''
  const { selectedTenantId, selectedTenantName } = useTenantContext()

  const masterDataQuery = useQuery({
    queryKey: masterDataQueryKey(selectedTenantId),
    queryFn: () => fetchMasterData({ tenantId: selectedTenantId }),
  })
  const inventoryQuery = useQuery({
    queryKey: inventoryDashboardQueryKey(selectedTenantId, selectedSiteId),
    queryFn: () =>
      fetchInventoryDashboard({
        tenantId: selectedTenantId,
        siteId: selectedSiteId || undefined,
      }),
    staleTime: 60_000,
  })

  const sites = useMemo(
    () =>
      masterDataQuery.data?.data.entities.filter(
        (entity) => entity.entity_type === 'INTERNAL_SITE',
      ) ?? [],
    [masterDataQuery.data],
  )
  const materials = useMemo(
    () => masterDataQuery.data?.data.materials ?? [],
    [masterDataQuery.data],
  )
  const visibleSites = selectedSiteId
    ? sites.filter((site) => site.id === selectedSiteId)
    : sites
  const selectedSite = sites.find((site) => site.id === selectedSiteId)
  const inventory = inventoryQuery.data?.data
  const balances = new Map(
    (inventory?.balances ?? []).map((balance) => [
      `${balance.site_id}:${balance.material_id}`,
      balance,
    ]),
  )
  const materialById = new Map(materials.map((material) => [material.id, material]))
  const siteById = new Map(sites.map((site) => [site.id, site]))
  const alerts = (inventory?.balances ?? [])
    .filter(
      (balance) =>
        balance.status === 'CRITICAL' || balance.status === 'OUT_OF_STOCK',
    )
    .slice(0, 8)

  useEffect(() => {
    const preferenceKey = `concove-dashboard-site:${selectedTenantId}`

    if (
      selectedSiteId &&
      !masterDataQuery.isLoading &&
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

    if (!selectedSiteId && !masterDataQuery.isLoading) {
      const preferredSiteId = window.localStorage.getItem(preferenceKey)
      if (preferredSiteId && sites.some((site) => site.id === preferredSiteId)) {
        setSearchParams({ site: preferredSiteId }, { replace: true })
      }
    }
  }, [masterDataQuery.isLoading, selectedSiteId, selectedTenantId, setSearchParams, sites])

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
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-lg shadow-slate-200/60">
        <div className="flex flex-col gap-6 p-5 sm:p-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
              Command Center
            </p>
            <div>
              <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                Inventory God View
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Monitor stock health across the tenant, surface urgent risks, and jump directly
                into Operations from one dashboard.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[34rem] xl:grid-cols-3">
            <HeroStat label="Tracked materials" value={inventory?.summary.material_count ?? 0} />
            <HeroStat label="Critical risks" value={inventory?.summary.critical_stock_count ?? 0} />
            <HeroStat label="Out of stock" value={inventory?.summary.out_of_stock_count ?? 0} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-200 sm:px-6">
          <div>
            <span className="font-semibold text-white">Scope:</span>{' '}
            {selectedSite?.name ?? 'All sites'} · {selectedTenantName}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/materials"
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              Open materials
            </Link>
            <Link
              to="/site-materials"
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              Adjust thresholds
            </Link>
            <Link
              to="/operations"
              className="rounded-full border border-amber-300/40 bg-amber-300/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/25"
            >
              Record movement
            </Link>
          </div>
        </div>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Inventory Dashboard</h2>
          <p className="mt-1 text-sm text-slate-600">
            {selectedSite?.name ?? 'All sites'} inventory health for {selectedTenantName}.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <label htmlFor="site-select" className="mb-1 block text-sm font-medium text-slate-700">
          Site scope
        </label>
        {masterDataQuery.isLoading ? (
          <div className="h-8 w-full max-w-md animate-pulse rounded-md bg-slate-100" />
        ) : null}
        {masterDataQuery.isError ? (
          <ErrorState
            message={formatApiError(masterDataQuery.error, 'Failed to load site options.')}
            onRetry={() => masterDataQuery.refetch()}
          />
        ) : null}
        {!masterDataQuery.isLoading && !masterDataQuery.isError ? (
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

      {inventoryQuery.isLoading ? <DashboardSkeleton /> : null}
      {inventoryQuery.isError ? (
        <ErrorState
          title="Live inventory is unavailable"
          message={formatApiError(
            inventoryQuery.error,
            'The inventory dashboard API could not be loaded. Master data remains available.',
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

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr),minmax(18rem,1fr)]">
            <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
                {selectedSite ? 'Material balances' : 'Site inventory heatmap'}
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-semibold text-slate-700">Material</th>
                      {visibleSites.map((site) => (
                        <th key={site.id} className="px-2 py-1.5 text-left font-semibold text-slate-700">
                          {site.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {materials.map((material) => (
                      <tr key={material.id}>
                        <td className="px-2 py-1.5">
                          <p className="font-medium text-slate-900">{material.material_code}</p>
                          <p className="max-w-56 truncate text-xs text-slate-500">{material.description}</p>
                        </td>
                        {visibleSites.map((site) => (
                          <td key={`${material.id}-${site.id}`} className="px-2 py-1.5">
                            <BalanceCell
                              balance={balances.get(`${site.id}:${material.id}`)}
                              siteId={site.id}
                              materialId={material.id}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {materials.length === 0 || visibleSites.length === 0 ? (
                      <tr>
                        <td
                          colSpan={Math.max(2, visibleSites.length + 1)}
                          className="px-3 py-8 text-center text-slate-500"
                        >
                          {sites.length === 0
                            ? 'No internal sites are configured for this tenant.'
                            : 'No materials are configured for this tenant.'}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Critical alerts</h3>
              <p className="mt-1 text-xs text-slate-500">Immediate risks in the current site scope.</p>
              <ul className="mt-3 space-y-2">
                {alerts.map((balance) => (
                  <li
                    key={`${balance.site_id}:${balance.material_id}`}
                    className={`rounded-md border px-3 py-2 ${statusStyles[balance.status]}`}
                  >
                    <div className="flex justify-between gap-2">
                      <p className="font-medium">
                        {materialById.get(balance.material_id)?.material_code ?? balance.material_id}
                      </p>
                      <span className="text-xs font-semibold">{statusLabels[balance.status]}</span>
                    </div>
                    <p className="mt-1 text-xs">
                      {siteById.get(balance.site_id)?.name ?? balance.site_id}: {' '}
                      {formatQuantity(balance.quantity_base_uom)} {balance.base_uom_id}
                      {balance.threshold_quantity === null
                        ? ''
                        : ` / threshold ${formatQuantity(balance.threshold_quantity)}`}
                    </p>
                    <Link
                      className="mt-2 inline-block text-xs font-semibold underline"
                      to={`/operations?mode=ledger&site=${encodeURIComponent(balance.site_id)}&material=${encodeURIComponent(balance.material_id)}&type=INWARD`}
                    >
                      Record receipt
                    </Link>
                  </li>
                ))}
                {alerts.length === 0 ? (
                  <li className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    No critical stock risks in this scope.
                  </li>
                ) : null}
              </ul>
            </aside>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <DataList
              title="Pending receipts"
              empty="No pending purchase-order receipts in this scope."
              items={inventory.pending_receipts.map((receipt) => ({
                id: `${receipt.po_id}:${receipt.material_id}`,
                title: `${receipt.po_number} · ${materialById.get(receipt.material_id)?.material_code ?? receipt.material_id}`,
                detail: `${formatQuantity(receipt.received_quantity_base_uom)} of ${formatQuantity(receipt.ordered_quantity_base_uom)} received · due ${receipt.expected_delivery_date}`,
              }))}
            />
            <DataList
              title="Recent movements"
              empty="No recent inventory movements in this scope."
              items={inventory.recent_movements.map((movement) => ({
                id: movement.transaction_id,
                title: `${movement.transaction_type.replaceAll('_', ' ')} · ${materialById.get(movement.material_id)?.material_code ?? movement.material_id}`,
                detail: `${siteById.get(movement.site_id)?.name ?? movement.site_id} · ${formatQuantity(movement.quantity)} · ${formatTimestamp(movement.recorded_at)}`,
              }))}
            />
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

function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

interface ListItem {
  id: string
  title: string
  detail: string
}

function DataList({ title, empty, items }: { title: string; empty: string; items: ListItem[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <h3 className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
        {title}
      </h3>
      <ul className="divide-y divide-slate-100">
        {items.slice(0, 8).map((item) => (
          <li key={item.id} className="px-4 py-2">
            <p className="text-sm font-medium text-slate-900">{item.title}</p>
            <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
          </li>
        ))}
        {items.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-slate-500">{empty}</li>
        ) : null}
      </ul>
    </section>
  )
}

export default Dashboard