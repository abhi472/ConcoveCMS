import { useDeferredValue, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchInventoryBalances } from '../api/inventoryService'
import { fetchSiteMaterials } from '../api/siteMaterialService'
import { fetchPurchaseOrders } from '../api/purchaseOrdersService'
import { fetchTransactionHistory } from '../api/transactionHistoryService'
import { fetchAuditEvents } from '../api/auditService'
import MaterialCodeNormalizer from '../components/MaterialCodeNormalizer'
import {
  archiveMaterial,
  createMaterial,
  fetchMaterials,
  formatMaterialError,
  importMaterialsCsv,
  restoreMaterial,
  updateMaterial,
  type CsvImportResponse,
  type ManagedMaterial,
  type MaterialInput,
} from '../api/materialsService'
import { auditEventsQueryKey, inventoryBalancesQueryKey, materialsQueryKey, purchaseOrdersQueryKey, siteMaterialsQueryKey, transactionsQueryKey } from '../api/queryKeys'
import { useAuthContext } from '../context/useAuthContext'
import { useTenantContext } from '../context/useTenantContext'
import { hasRequiredRole } from '../types/rbac'
import type { UOM } from '../types/schema'

const uomOptions: UOM[] = ['LITER', 'KG', 'BAG', 'TON', 'PIECE', 'METER']
const emptyForm: MaterialInput = {
  materialCode: '',
  description: '',
  baseUomId: 'PIECE',
  issueUomId: 'PIECE',
  conversionFactor: 1,
}

function normalizeMaterialCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function downloadCsvTemplate(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function MaterialsPage() {
  const queryClient = useQueryClient()
  const { user } = useAuthContext()
  const { selectedTenantId, selectedTenantName } = useTenantContext()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active')
  const [baseUomId, setBaseUomId] = useState('')
  const [sort, setSort] = useState<'material_code' | 'description' | 'updated_at'>('material_code')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [editingMaterial, setEditingMaterial] = useState<ManagedMaterial | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [form, setForm] = useState<MaterialInput>(emptyForm)
  const [isDirty, setIsDirty] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<ManagedMaterial | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<ManagedMaterial | null>(null)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null)
  const [csvImportResult, setCsvImportResult] = useState<CsvImportResponse | null>(null)

  const filters = {
    search: deferredSearch,
    status,
    baseUomId,
    sort,
    direction,
    page,
    pageSize: 50,
  }
  const materialsQuery = useQuery({
    queryKey: materialsQueryKey(selectedTenantId, filters),
    queryFn: () => fetchMaterials({ tenantId: selectedTenantId, ...filters }),
    placeholderData: (previousData) => previousData,
  })
  const detailsAssignmentsQuery = useQuery({
    queryKey: siteMaterialsQueryKey(selectedTenantId),
    queryFn: () => fetchSiteMaterials(selectedTenantId),
    enabled: Boolean(detailsTarget),
  })
  const detailsBalancesQuery = useQuery({
    queryKey: inventoryBalancesQueryKey(selectedTenantId, undefined, detailsTarget?.id),
    queryFn: () => fetchInventoryBalances({ tenantId: selectedTenantId, materialId: detailsTarget!.id }),
    enabled: Boolean(detailsTarget),
  })
  const detailsOrdersQuery = useQuery({
    queryKey: purchaseOrdersQueryKey(selectedTenantId, { materialId: detailsTarget?.id }),
    queryFn: () => fetchPurchaseOrders(selectedTenantId, { materialId: detailsTarget!.id }),
    enabled: Boolean(detailsTarget),
  })
  const detailsTransactionsQuery = useQuery({
    queryKey: transactionsQueryKey(selectedTenantId, { materialId: detailsTarget?.id, pageSize: 5 }),
    queryFn: () => fetchTransactionHistory({ tenantId: selectedTenantId, materialId: detailsTarget!.id, pageSize: 5 }),
    enabled: Boolean(detailsTarget),
  })
  const detailsAuditQuery = useQuery({
    queryKey: auditEventsQueryKey(selectedTenantId, { resourceType: 'MATERIAL', resourceId: detailsTarget?.id }),
    queryFn: () => fetchAuditEvents({ tenantId: selectedTenantId, resourceType: 'MATERIAL', resourceId: detailsTarget!.id, pageSize: 10 }),
    enabled: Boolean(detailsTarget),
  })

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isDirty])

  async function invalidateMaterialData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['materials', selectedTenantId] }),
      queryClient.invalidateQueries({ queryKey: ['master-data', selectedTenantId] }),
      queryClient.invalidateQueries({ queryKey: ['site-materials', selectedTenantId] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard', selectedTenantId] }),
    ])
  }

  function closeEditor() {
    if (isDirty && !window.confirm('Discard unsaved material changes?')) return
    setIsEditorOpen(false)
    setEditingMaterial(null)
    setForm(emptyForm)
    setIsDirty(false)
  }

  function openCreate() {
    setEditingMaterial(null)
    setForm(emptyForm)
    setIsDirty(false)
    setFeedback(null)
    setIsEditorOpen(true)
  }

  function openEdit(material: ManagedMaterial) {
    setEditingMaterial(material)
    setForm({
      materialCode: material.material_code,
      description: material.description,
      baseUomId: material.base_uom_id,
      issueUomId: material.issue_uom_id,
      conversionFactor: Number(material.conversion_factor),
    })
    setIsDirty(false)
    setFeedback(null)
    setIsEditorOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => editingMaterial
      ? updateMaterial(selectedTenantId, editingMaterial.id, form)
      : createMaterial(selectedTenantId, form),
    onSuccess: async (material) => {
      setFeedback({
        kind: 'success',
        message: `${material.material_code} ${editingMaterial ? 'updated' : 'created'}.`,
      })
      setIsDirty(false)
      setIsEditorOpen(false)
      setEditingMaterial(null)
      setForm(emptyForm)
      await invalidateMaterialData()
    },
    onError: (error) => setFeedback({ kind: 'error', message: formatMaterialError(error) }),
  })

  const archiveMutation = useMutation({
    mutationFn: (material: ManagedMaterial) => archiveMaterial(selectedTenantId, material.id),
    onSuccess: async (material) => {
      setArchiveTarget(null)
      setFeedback({ kind: 'success', message: `${material.material_code} archived.` })
      await invalidateMaterialData()
    },
    onError: (error) => setFeedback({ kind: 'error', message: formatMaterialError(error) }),
  })

  const restoreMutation = useMutation({
    mutationFn: (material: ManagedMaterial) => restoreMaterial(selectedTenantId, material.id),
    onSuccess: async (material) => {
      setFeedback({ kind: 'success', message: `${material.material_code} restored.` })
      await invalidateMaterialData()
    },
    onError: (error) => setFeedback({ kind: 'error', message: formatMaterialError(error) }),
  })

  const importCsvMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCsvFile) throw new Error('Select a CSV file before importing.')
      const csvContent = await selectedCsvFile.text()
      return importMaterialsCsv(selectedTenantId, csvContent)
    },
    onSuccess: async (response) => {
      setCsvImportResult(response)
      const successCount = response.results.filter((row) => row.sync_status === 'SUCCESS').length
      const failureCount = response.results.length - successCount
      setFeedback({
        kind: failureCount > 0 ? 'error' : 'success',
        message: failureCount > 0
          ? `Material CSV imported ${successCount} rows with ${failureCount} failures.`
          : `Material CSV imported successfully (${successCount} rows).`,
      })
      await invalidateMaterialData()
    },
    onError: (error) => setFeedback({ kind: 'error', message: formatMaterialError(error) }),
  })

  const normalizedCode = normalizeMaterialCode(form.materialCode)
  const canManageMaterials = Boolean(user && hasRequiredRole(user.role, ['ADMIN', 'SITE_MANAGER']))
  const total = materialsQuery.data?.pagination.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 50))
  const materials = materialsQuery.data?.data ?? []
  const formValid = Boolean(normalizedCode && form.description.trim() && form.conversionFactor > 0)

  const handleDownloadMaterialTemplate = () => {
    const headers = 'material_code,description,base_uom_id,issue_uom_id,conversion_factor'
    const sampleRow = 'cement-opc-43,OPC Cement 43 Grade,BAG,KG,50'
    downloadCsvTemplate('materials_template.csv', `${headers}\n${sampleRow}\n`)
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Material Catalog</h2>
          <p className="mt-1 text-sm text-slate-600">
            Tenant-owned materials, units, conversion rules, and lifecycle.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {selectedTenantName}
          </span>
          <button
            type="button"
            onClick={openCreate}
            disabled={!canManageMaterials}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Material
          </button>
        </div>
      </header>

      {!canManageMaterials ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Your role has read-only access for material catalog data.
        </p>
      ) : null}

      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Bulk CSV Upload</h3>
        <p className="mt-1 text-xs text-slate-600">
          Headers: material_code, description, base_uom_id, issue_uom_id, conversion_factor
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setSelectedCsvFile(event.target.files?.[0] ?? null)}
            className="block w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          />
          <button
            type="button"
            onClick={handleDownloadMaterialTemplate}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Download Template
          </button>
          <button
            type="button"
            disabled={!canManageMaterials || !selectedCsvFile || importCsvMutation.isPending}
            onClick={() => importCsvMutation.mutate()}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {importCsvMutation.isPending ? 'Importing...' : 'Import Materials CSV'}
          </button>
          {selectedCsvFile ? <span className="text-xs text-slate-500">{selectedCsvFile.name}</span> : null}
        </div>
          <p className="mt-2 text-xs text-slate-500">Template file: materials_template.csv</p>
        {csvImportResult ? (
          <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-1.5 text-left">Row</th>
                  <th className="px-2 py-1.5 text-left">Reference</th>
                  <th className="px-2 py-1.5 text-left">Status</th>
                  <th className="px-2 py-1.5 text-left">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {csvImportResult.results.map((row) => (
                  <tr key={`${row.row_number}-${row.reference}`}>
                    <td className="px-2 py-1.5">{row.row_number}</td>
                    <td className="px-2 py-1.5">{row.reference}</td>
                    <td className="px-2 py-1.5">{row.sync_status}</td>
                    <td className="px-2 py-1.5">{row.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 border-y border-slate-200 bg-white px-4 py-3 md:grid-cols-[minmax(14rem,1fr)_10rem_10rem_12rem]">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            placeholder="Code or description"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1) }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Base UoM</span>
          <select
            value={baseUomId}
            onChange={(event) => { setBaseUomId(event.target.value); setPage(1) }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All units</option>
            {uomOptions.map((uom) => <option key={uom}>{uom}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Sort</span>
          <div className="flex">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="min-w-0 flex-1 rounded-l-md border border-slate-300 bg-white px-2 py-2 text-sm"
            >
              <option value="material_code">Code</option>
              <option value="description">Description</option>
              <option value="updated_at">Updated</option>
            </select>
            <button
              type="button"
              title="Reverse sort direction"
              onClick={() => setDirection((value) => value === 'asc' ? 'desc' : 'asc')}
              className="rounded-r-md border border-l-0 border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
            >
              {direction === 'asc' ? 'ASC' : 'DESC'}
            </button>
          </div>
        </label>
      </div>

      {feedback ? (
        <div className={`border px-4 py-3 text-sm ${feedback.kind === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
        >
          {feedback.message}
        </div>
      ) : null}

      {materialsQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
        </div>
      ) : null}
      {materialsQuery.isError ? (
        <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {formatMaterialError(materialsQuery.error)}
        </div>
      ) : null}
      {!materialsQuery.isLoading && !materialsQuery.isError && materials.length === 0 ? (
        <div className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No materials match these filters.
        </div>
      ) : null}

      {materials.length > 0 ? (
        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Code</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Base / Issue</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Factor</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {materials.map((material) => (
                  <tr key={material.id} className={material.archived_at ? 'bg-slate-50 text-slate-500' : 'hover:bg-slate-50'}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{material.material_code}</td>
                    <td className="px-4 py-3 text-slate-700">{material.description}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{material.base_uom_id} / {material.issue_uom_id}</td>
                    <td className="px-4 py-3 text-slate-600">{material.conversion_factor}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${material.archived_at
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-emerald-100 text-emerald-800'}`}
                      >
                        {material.archived_at ? 'Archived' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setDetailsTarget(material)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Details</button>
                        {!material.archived_at ? (
                          <>
                            <button type="button" disabled={!canManageMaterials} onClick={() => openEdit(material)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Edit</button>
                            <Link to={`/site-materials?material=${encodeURIComponent(material.material_code)}`} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Sites</Link>
                            <button type="button" disabled={!canManageMaterials} onClick={() => { setFeedback(null); setArchiveTarget(material) }} className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-40">Archive</button>
                          </>
                        ) : (
                          <button type="button" disabled={!canManageMaterials || restoreMutation.isPending} onClick={() => restoreMutation.mutate(material)} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Restore</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>{total.toLocaleString()} materials</span>
            <div className="flex items-center gap-3">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button>
              <span>Page {page} of {pageCount}</span>
              <button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditorOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor() }}>
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="material-editor-title">
            <div className="flex items-start justify-between">
              <div>
                <h3 id="material-editor-title" className="text-lg font-semibold text-slate-900">{editingMaterial ? 'Edit Material' : 'Add Material'}</h3>
                <p className="mt-1 text-sm text-slate-600">Codes are normalized to lowercase kebab-case.</p>
              </div>
              <button type="button" onClick={closeEditor} aria-label="Close material editor" className="text-2xl text-slate-500">×</button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); if (canManageMaterials && formValid) saveMutation.mutate() }}>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Material code</span>
                <input disabled={!canManageMaterials} value={form.materialCode} onChange={(event) => { setForm((value) => ({ ...value, materialCode: event.target.value })); setIsDirty(true) }} className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
                {form.materialCode ? <MaterialCodeNormalizer originalCode={form.materialCode} normalizedCode={normalizedCode} /> : null}
              </label>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Description</span>
                <input disabled={!canManageMaterials} value={form.description} onChange={(event) => { setForm((value) => ({ ...value, description: event.target.value })); setIsDirty(true) }} className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  <span>Base UoM</span>
                  <select disabled={!canManageMaterials} value={form.baseUomId} onChange={(event) => { setForm((value) => ({ ...value, baseUomId: event.target.value as UOM })); setIsDirty(true) }} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100">{uomOptions.map((uom) => <option key={uom}>{uom}</option>)}</select>
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  <span>Issue UoM</span>
                  <select disabled={!canManageMaterials} value={form.issueUomId} onChange={(event) => { setForm((value) => ({ ...value, issueUomId: event.target.value as UOM })); setIsDirty(true) }} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100">{uomOptions.map((uom) => <option key={uom}>{uom}</option>)}</select>
                </label>
              </div>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Conversion factor</span>
                <input disabled={!canManageMaterials} type="number" min="0.000001" step="0.000001" value={form.conversionFactor} onChange={(event) => { setForm((value) => ({ ...value, conversionFactor: Number(event.target.value) })); setIsDirty(true) }} className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
                <p className="text-xs font-normal text-slate-500">Base units represented by one issue unit.</p>
              </label>
              {feedback?.kind === 'error' ? <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{feedback.message}</p> : null}
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={closeEditor} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                <button type="submit" disabled={!canManageMaterials || !formValid || saveMutation.isPending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saveMutation.isPending ? 'Saving...' : 'Save Material'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailsTarget ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsTarget(null) }}>
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="material-details-title">
            <div className="flex items-start justify-between gap-4">
              <div><h3 id="material-details-title" className="text-lg font-semibold text-slate-900">{detailsTarget.material_code}</h3><p className="mt-1 text-sm text-slate-600">{detailsTarget.description}</p></div>
              <button type="button" onClick={() => setDetailsTarget(null)} aria-label="Close material details" className="text-2xl text-slate-500">×</button>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 border-y border-slate-200 py-4 text-sm">
              <div><p className="text-xs text-slate-500">Units</p><p className="font-semibold">{detailsTarget.base_uom_id} / {detailsTarget.issue_uom_id}</p></div>
              <div><p className="text-xs text-slate-500">Conversion</p><p className="font-semibold">{detailsTarget.conversion_factor}</p></div>
              <div><p className="text-xs text-slate-500">Status</p><p className="font-semibold">{detailsTarget.archived_at ? 'Archived' : 'Active'}</p></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to={`/site-materials?material=${encodeURIComponent(detailsTarget.material_code)}`} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Manage sites</Link>
              <Link to={`/operations?mode=ledger&material=${detailsTarget.id}&type=INWARD`} className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Record receipt</Link>
              <Link to={`/operations?mode=ledger&material=${detailsTarget.id}&type=OUTWARD`} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Record issue</Link>
            </div>
            <div className="mt-6 space-y-5 text-sm">
              <section><h4 className="font-semibold text-slate-900">Sites and balances</h4><div className="mt-2 divide-y divide-slate-100 border border-slate-200">
                {(detailsAssignmentsQuery.data ?? []).filter((item) => item.material_id === detailsTarget.id && item.is_active).map((assignment) => {
                  const balance = detailsBalancesQuery.data?.data.find((item) => item.site_id === assignment.site_id)
                  return <div key={assignment.site_id} className="flex items-center justify-between px-3 py-2"><span>{assignment.site_name}</span><span className="font-medium">{balance?.quantity_base_uom.toLocaleString() ?? '—'} {assignment.base_uom_id} · {balance?.status ?? 'Loading'}</span></div>
                })}
                {!detailsAssignmentsQuery.isLoading && !(detailsAssignmentsQuery.data ?? []).some((item) => item.material_id === detailsTarget.id && item.is_active) ? <p className="px-3 py-3 text-slate-500">No active site assignments.</p> : null}
              </div></section>
              <section><h4 className="font-semibold text-slate-900">Open purchase orders</h4><div className="mt-2 space-y-2">{(detailsOrdersQuery.data?.data ?? []).filter((order) => order.status !== 'COMPLETED').slice(0, 5).map((order) => <div key={order.id} className="flex justify-between border-b border-slate-100 pb-2"><span>{order.po_number} · {order.target_site_name}</span><span>{Number(order.open_quantity_base_uom).toLocaleString()} open</span></div>)}{!detailsOrdersQuery.isLoading && !(detailsOrdersQuery.data?.data ?? []).some((order) => order.status !== 'COMPLETED') ? <p className="text-slate-500">No open purchase orders.</p> : null}</div></section>
              <section><h4 className="font-semibold text-slate-900">Recent movements</h4><div className="mt-2 space-y-2">{detailsTransactionsQuery.data?.data.map((transaction) => <div key={transaction.id} className="flex justify-between border-b border-slate-100 pb-2"><span>{transaction.site_name} · {transaction.transaction_type}</span><span>{Number(transaction.quantity).toLocaleString()} {transaction.quantity_uom}</span></div>)}{!detailsTransactionsQuery.isLoading && detailsTransactionsQuery.data?.data.length === 0 ? <p className="text-slate-500">No ledger activity.</p> : null}</div></section>
              <section><h4 className="font-semibold text-slate-900">Audit timeline</h4><div className="mt-2 space-y-2">{detailsAuditQuery.data?.data.map((event) => <div key={event.id} className="flex justify-between border-b border-slate-100 pb-2"><span>{event.action} · {event.actor_id}</span><time className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</time></div>)}{!detailsAuditQuery.isLoading && detailsAuditQuery.data?.data.length === 0 ? <p className="text-slate-500">No audit events recorded.</p> : null}</div></section>
            </div>
          </div>
        </div>
      ) : null}

      {archiveTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" role="alertdialog" aria-modal="true">
            <h3 className="text-lg font-semibold text-slate-900">Archive {archiveTarget.material_code}?</h3>
            <p className="mt-2 text-sm text-slate-600">It will disappear from new operations but remain visible in historical records. Active site assignments and open purchase orders must be resolved first.</p>
            {feedback?.kind === 'error' ? <p className="mt-3 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{feedback.message}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setArchiveTarget(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
              <button type="button" disabled={!canManageMaterials || archiveMutation.isPending} onClick={() => archiveMutation.mutate(archiveTarget)} className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Archive</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default MaterialsPage