import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMasterData } from '../api/masterDataService'
import { masterDataQueryKey } from '../api/queryKeys'
import { useTenantContext } from '../context/TenantContext'

function EntitiesPage() {
  const { selectedTenantId } = useTenantContext()
  const { data } = useQuery({
    queryKey: masterDataQueryKey(selectedTenantId),
    queryFn: () => fetchMasterData({ tenantId: selectedTenantId }),
  })

  const entities = data?.data.entities ?? []
  const grouped = useMemo(() => {
    return {
      INTERNAL_SITE: entities.filter((item) => item.entity_type === 'INTERNAL_SITE'),
      VENDOR: entities.filter((item) => item.entity_type === 'VENDOR'),
      SUBCONTRACTOR: entities.filter((item) => item.entity_type === 'SUBCONTRACTOR'),
      EMPLOYEE: entities.filter((item) => item.entity_type === 'EMPLOYEE'),
    }
  }, [entities])

  return (
    <section className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Entity Control Center</h2>
        <p className="mt-1 text-sm text-slate-600">Tenant-filtered view for Sites, Vendors, Subcontractors, and Employees.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {Object.entries(grouped).map(([type, items]) => (
          <article key={type} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wide text-slate-900">{type}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{items.length}</span>
            </div>
            <div className="max-h-56 overflow-auto">
              <ul className="space-y-2 text-sm text-slate-700">
                {items.map((entity) => (
                  <li key={entity.id} className="rounded-md bg-slate-50 px-3 py-2">
                    <p className="font-medium text-slate-900">{entity.name}</p>
                    <p className="font-mono text-xs text-slate-500">{entity.id}</p>
                  </li>
                ))}
                {items.length === 0 ? <li className="text-slate-500">No records found.</li> : null}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default EntitiesPage