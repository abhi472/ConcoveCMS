import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMasterData } from '../api/masterDataService'
import { formatApiError } from '../api/errorUtils'
import { masterDataQueryKey } from '../api/queryKeys'
import { useTenantContext } from '../context/TenantContext'
import MaterialCodeNormalizer from '../components/MaterialCodeNormalizer'
import type { Material, UOM } from '../types/schema'

interface MaterialDraft extends Omit<Material, 'id'> {
  id: string
}

const uomOptions: UOM[] = ['LITER', 'KG', 'BAG', 'TON', 'PIECE', 'METER']

function normalizeMaterialCode(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function MaterialsPage() {
  const { selectedTenantId, selectedTenantName } = useTenantContext()
  const [materialCode, setMaterialCode] = useState('')
  const [description, setDescription] = useState('')
  const [baseUomId, setBaseUomId] = useState<UOM>('PIECE')
  const [issueUomId, setIssueUomId] = useState<UOM>('PIECE')
  const [conversionFactor, setConversionFactor] = useState('1')
  const [draftMaterials, setDraftMaterials] = useState<MaterialDraft[]>([])
  const normalizedMaterialCode = useMemo(
    () => normalizeMaterialCode(materialCode),
    [materialCode],
  )

  const { data, isLoading, isError, error } = useQuery({
    queryKey: masterDataQueryKey(selectedTenantId),
    queryFn: () => fetchMasterData({ tenantId: selectedTenantId }),
  })

  const materials = data?.data.materials ?? []

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800">
        <h2 className="text-base font-semibold">Failed to load materials</h2>
        <p className="mt-1 text-sm">
          {formatApiError(
            error,
            `Unable to load materials for ${selectedTenantName}. Check tenant configuration.`,
          )}
        </p>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold text-slate-900">Material Catalog</h2>
        <p className="mt-1 text-sm text-slate-600">Central list of all approved materials.</p>
      </header>

      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Create Material Draft</h3>
        <p className="mt-1 text-sm text-slate-600">
          Material codes are normalized to lowercase kebab-case before submit.
        </p>
        <form
          className="mt-4 grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!normalizedMaterialCode) {
              return
            }

            const draft: MaterialDraft = {
              id: crypto.randomUUID(),
              material_code: normalizedMaterialCode,
              description: description.trim(),
              base_uom_id: baseUomId,
              issue_uom_id: issueUomId,
              conversion_factor: Number(conversionFactor),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }

            setDraftMaterials((current) => [draft, ...current])
            setMaterialCode('')
            setDescription('')
            setBaseUomId('PIECE')
            setIssueUomId('PIECE')
            setConversionFactor('1')
          }}
        >
          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Material Code</span>
            <input
              value={materialCode}
              onChange={(event) => setMaterialCode(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="TMT Steel 12mm"
            />
            {materialCode && <MaterialCodeNormalizer originalCode={materialCode} normalizedCode={normalizedMaterialCode} />}
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Description</span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Reinforcement steel bar"
            />
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Base UoM</span>
            <select
              value={baseUomId}
              onChange={(event) => setBaseUomId(event.target.value as UOM)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {uomOptions.map((uom) => (
                <option key={uom} value={uom}>
                  {uom}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Issue UoM</span>
            <select
              value={issueUomId}
              onChange={(event) => setIssueUomId(event.target.value as UOM)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {uomOptions.map((uom) => (
                <option key={uom} value={uom}>
                  {uom}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm font-medium text-slate-700">
            <span>Conversion Factor</span>
            <input
              type="number"
              step="0.000001"
              value={conversionFactor}
              onChange={(event) => setConversionFactor(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Stage Material Draft
            </button>
          </div>
        </form>

        {draftMaterials.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Base</th>
                  <th className="px-3 py-2 text-left">Issue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draftMaterials.map((draft) => (
                  <tr key={draft.id}>
                    <td className="px-3 py-2 font-medium text-slate-900">{draft.material_code}</td>
                    <td className="px-3 py-2 text-slate-700">{draft.description}</td>
                    <td className="px-3 py-2 text-slate-700">{draft.base_uom_id}</td>
                    <td className="px-3 py-2 text-slate-700">{draft.issue_uom_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {materials.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">No materials found</h2>
          <p className="mt-2 text-sm text-slate-600">The material catalog is empty.</p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-600">Material Code</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-600">Description</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-600">Base UoM</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-600">Issue UoM</th>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-slate-600">Conversion Factor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {materials.map((material) => (
                <tr key={material.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{material.material_code}</td>
                  <td className="px-4 py-3 text-slate-700">{material.description}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{material.base_uom_id}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{material.issue_uom_id}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{material.conversion_factor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default MaterialsPage