import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMasterData } from '../api/masterDataService'
import { formatApiError } from '../api/errorUtils'
import { masterDataQueryKey } from '../api/queryKeys'
import { useTenantContext } from '../context/TenantContext'

function scoreColor(score: number) {
  if (score < 30) return 'bg-rose-100 text-rose-700'
  if (score < 60) return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

function pseudoScore(materialId: string, siteId: string) {
  const seed = `${materialId}${siteId}`
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash % 100)
}

function Dashboard() {
  const [selectedSiteId, setSelectedSiteId] = useState('')
  const { selectedTenantId, selectedTenantName } = useTenantContext()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: masterDataQueryKey(selectedTenantId),
    queryFn: () => fetchMasterData({ tenantId: selectedTenantId }),
  })

  const sites =
    data?.data.entities.filter((entity) => entity.entity_type === 'INTERNAL_SITE') ?? []
  const materials = data?.data.materials ?? []
  const criticalAlerts = materials
    .map((material) => {
      const minScore = sites.reduce((lowest, site) => {
        const score = pseudoScore(material.id, site.id)
        return Math.min(lowest, score)
      }, 100)
      return { materialCode: material.material_code, score: minScore }
    })
    .filter((item) => item.score < 30)
    .slice(0, 8)

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Global Inventory Dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">Tenant-wide God View for site inventory risk monitoring.</p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <label htmlFor="site-select" className="mb-2 block text-sm font-medium text-slate-700">
          Select Site
        </label>

        {isLoading ? (
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
            Loading sites...
          </div>
        ) : null}

        {isError ? (
          <p className="text-sm text-rose-700">
            {formatApiError(
              error,
              `Failed to load site options for ${selectedTenantName}. Check tenant selection.`,
            )}
          </p>
        ) : null}

        {!isLoading && !isError ? (
          <select
            id="site-select"
            className="w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 outline-none ring-slate-800 transition focus:ring-2"
            value={selectedSiteId}
            onChange={(event) => setSelectedSiteId(event.target.value)}
          >
            <option value="">Select a site</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr,1fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Inventory Heatmap</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1 text-left font-semibold text-slate-700">Material</th>
                  {sites.map((site) => (
                    <th key={site.id} className="px-2 py-1 text-left font-semibold text-slate-700">
                      {site.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materials.slice(0, 12).map((material) => (
                  <tr key={material.id}>
                    <td className="px-2 py-1 font-medium text-slate-900">{material.material_code}</td>
                    {sites.map((site) => {
                      const score = pseudoScore(material.id, site.id)
                      return (
                        <td key={`${material.id}-${site.id}`} className="px-2 py-1">
                          <span className={`rounded-md px-2 py-1 text-xs font-medium ${scoreColor(score)}`}>
                            {score}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(2, sites.length + 1)} className="px-3 py-8 text-center text-slate-500">
                      No materials available for heatmap view.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Heatmap is currently a risk visualization placeholder until live stock-balance reporting API is integrated.
          </p>
        </div>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Critical Alerts</h3>
          <p className="mt-1 text-xs text-slate-500">Materials with lowest site score under alert threshold.</p>
          <ul className="mt-3 space-y-2">
            {criticalAlerts.map((alert) => (
              <li key={alert.materialCode} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
                <p className="font-medium text-rose-800">{alert.materialCode}</p>
                <p className="text-xs text-rose-700">Stockout risk index: {alert.score}</p>
              </li>
            ))}
            {criticalAlerts.length === 0 ? (
              <li className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                No critical stockout risks detected.
              </li>
            ) : null}
          </ul>
        </aside>
      </div>
    </section>
  )
}

export default Dashboard