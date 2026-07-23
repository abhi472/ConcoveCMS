import { Outlet, useLocation } from 'react-router-dom'
import { useTenantContext } from '../context/TenantContext'
import Sidebar from './Sidebar'

function Layout() {
  const {
    selectedTenantId,
    selectedTenantName,
    availableTenants,
    setSelectedTenantId,
  } = useTenantContext()
  const location = useLocation()

  const breadcrumbMap: Record<string, string> = {
    '/': 'Dashboard > God View',
    '/materials': 'Material Catalog > Manager',
    '/entities': 'Entities > Sites and Vendors',
    '/operations': 'Operations > Ledger Adjustment',
    '/sync-monitor': 'Sync Monitor > Multi-Status Inspector',
  }

  const breadcrumb = breadcrumbMap[location.pathname] ?? 'Workspace'

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
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                Backend Connected
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                Last heartbeat: just now
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