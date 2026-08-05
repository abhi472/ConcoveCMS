import { Outlet, useLocation } from 'react-router-dom'
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query'
import { useTenantContext } from '../context/useTenantContext'
import Sidebar from './Sidebar'

function Layout() {
  const {
    selectedTenantId,
    selectedTenantName,
    availableTenants,
    setSelectedTenantId,
  } = useTenantContext()
  const location = useLocation()
  const queryClient = useQueryClient()
  const fetchingCount = useIsFetching()
  const mutatingCount = useIsMutating()

  const breadcrumbMap: Record<string, string> = {
    '/': 'Dashboard',
    '/materials': 'Materials / Catalog',
    '/site-materials': 'Materials / Site assignments',
    '/entities': 'Entities / Directory',
    '/equipment': 'Equipment / Registry',
    '/operations': 'Operations',
    '/sync-monitor': 'Sync Monitor',
  }

  const params = new URLSearchParams(location.search)
  const mode = params.get('mode')
  const breadcrumb = `${breadcrumbMap[location.pathname] ?? 'Workspace'}${mode ? ` / ${mode.replace('-', ' ')}` : ''}`
  const contextEntries = ['site', 'material', 'po', 'retry', 'correction']
    .map((key) => [key, params.get(key)] as const)
    .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
  const tenantQueries = queryClient.getQueryCache().findAll({
    predicate: (query) => query.queryKey.includes(selectedTenantId),
  })
  const hasQueryError = tenantQueries.some((query) => query.state.status === 'error')
  const lastUpdatedAt = Math.max(0, ...tenantQueries.map((query) => query.state.dataUpdatedAt))
  const freshness = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Waiting for data'

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {breadcrumb}
              </p>
              <h1 className="mt-1 text-lg font-semibold text-slate-900">{selectedTenantName}</h1>
              {contextEntries.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{contextEntries.map(([key, value]) => <span key={key} className="max-w-56 truncate rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600">{key}: {value}</span>)}</div> : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className={`rounded-md border px-2 py-1 text-xs font-medium ${hasQueryError ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                {hasQueryError ? 'API attention needed' : fetchingCount > 0 ? 'Refreshing API data' : 'API data available'}
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                {mutatingCount > 0 ? `${mutatingCount} change${mutatingCount === 1 ? '' : 's'} saving` : `Fresh as of ${freshness}`}
              </div>
              <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600" title="Trusted backend service actor; authenticated user identity is not configured">
                Actor: cms-service
              </div>
              <label htmlFor="tenant-select" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tenant
              </label>
              <select
                id="tenant-select"
                value={selectedTenantId}
                onChange={(event) => setSelectedTenantId(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
              >
                {availableTenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout