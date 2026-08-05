import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMasterData } from '../api/masterDataService'
import { masterDataQueryKey } from '../api/queryKeys'
import { useCreateEquipment, useEquipment, useUpdateEquipment } from '../api/equipmentQueries'
import { formatEquipmentError, type EquipmentInput } from '../api/equipmentService'
import { useAuthContext } from '../context/useAuthContext'
import { useTenantContext } from '../context/useTenantContext'
import { hasRequiredRole } from '../types/rbac'
import type { Equipment, EquipmentStatus } from '../types/schema'

const statusOptions: EquipmentStatus[] = ['ACTIVE', 'IN_MAINTENANCE', 'INACTIVE']
const statusBadgeStyles: Record<EquipmentStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  IN_MAINTENANCE: 'bg-amber-100 text-amber-800',
  INACTIVE: 'bg-slate-200 text-slate-600',
}
const emptyForm: EquipmentInput = {
  name: '',
  registrationNumber: '',
  make: '',
  model: '',
  currentSiteId: '',
  status: 'ACTIVE',
}

function EquipmentPage() {
  const { user } = useAuthContext()
  const { selectedTenantId, selectedTenantName } = useTenantContext()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [status, setStatus] = useState<EquipmentStatus | 'all'>('all')
  const [siteId, setSiteId] = useState('')
  const [page, setPage] = useState(1)
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [form, setForm] = useState<EquipmentInput>(emptyForm)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const masterDataQuery = useQuery({
    queryKey: masterDataQueryKey(selectedTenantId),
    queryFn: () => fetchMasterData({ tenantId: selectedTenantId }),
  })
  const sites = (masterDataQuery.data?.data.entities ?? []).filter((entity) => entity.entity_type === 'INTERNAL_SITE')

  const filters = { search: deferredSearch, status, siteId, page, pageSize: 50 }
  const equipmentQuery = useEquipment({ tenantId: selectedTenantId, ...filters })
  const createMutation = useCreateEquipment(selectedTenantId)
  const updateMutation = useUpdateEquipment(selectedTenantId)

  function openCreate() {
    setEditingEquipment(null)
    setForm(emptyForm)
    setFeedback(null)
    setIsEditorOpen(true)
  }

  function openEdit(equipment: Equipment) {
    setEditingEquipment(equipment)
    setForm({
      name: equipment.name,
      registrationNumber: equipment.registration_number,
      make: equipment.make,
      model: equipment.model,
      currentSiteId: equipment.current_site_id ?? '',
      status: equipment.status,
    })
    setFeedback(null)
    setIsEditorOpen(true)
  }

  function closeEditor() {
    setIsEditorOpen(false)
    setEditingEquipment(null)
    setForm(emptyForm)
  }

  function saveEquipment() {
    const input: EquipmentInput = { ...form, currentSiteId: form.currentSiteId || null }
    const promise = editingEquipment
      ? updateMutation.mutateAsync({ equipmentId: editingEquipment.id, input })
      : createMutation.mutateAsync(input)
    promise
      .then((equipment) => {
        setFeedback({ kind: 'success', message: `${equipment.name} ${editingEquipment ? 'updated' : 'created'}.` })
        closeEditor()
      })
      .catch((error) => setFeedback({ kind: 'error', message: formatEquipmentError(error) }))
  }

  const equipmentList = equipmentQuery.data?.data ?? []
  const canManageEquipment = Boolean(user && hasRequiredRole(user.role, ['ADMIN', 'SITE_MANAGER', 'OPERATOR']))
  const total = equipmentQuery.data?.pagination.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 50))
  const formValid = Boolean(form.name.trim() && form.registrationNumber.trim() && form.make.trim() && form.model.trim())
  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <section className="space-y-4">
      <header className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Equipment Registry</h2>
          <p className="mt-1 text-sm text-slate-600">
            Fixed assets and vehicles tracked separately from consumable materials.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {selectedTenantName}
          </span>
          <button
            type="button"
            onClick={openCreate}
            disabled={!canManageEquipment}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Equipment
          </button>
        </div>
      </header>

      {!canManageEquipment ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Your role has read-only access for equipment records.
        </p>
      ) : null}

      <div className="grid gap-3 border-y border-slate-200 bg-white px-4 py-3 md:grid-cols-[minmax(14rem,1fr)_10rem_12rem]">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Search</span>
          <input
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            placeholder="Name or registration number"
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
            <option value="all">All</option>
            {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Site</span>
          <select
            value={siteId}
            onChange={(event) => { setSiteId(event.target.value); setPage(1) }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">All sites</option>
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
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

      {equipmentQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
        </div>
      ) : null}
      {equipmentQuery.isError ? (
        <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {formatEquipmentError(equipmentQuery.error)}
        </div>
      ) : null}
      {!equipmentQuery.isLoading && !equipmentQuery.isError && equipmentList.length === 0 ? (
        <div className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No equipment matches these filters.
        </div>
      ) : null}

      {equipmentList.length > 0 ? (
        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Reg No</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Make</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Model</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {equipmentList.map((equipment) => (
                  <tr key={equipment.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{equipment.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">{equipment.registration_number}</td>
                    <td className="px-4 py-3 text-slate-600">{equipment.make}</td>
                    <td className="px-4 py-3 text-slate-600">{equipment.model}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeStyles[equipment.status]}`}>
                        {equipment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" disabled={!canManageEquipment} onClick={() => openEdit(equipment)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>{total.toLocaleString()} equipment</span>
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
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="equipment-editor-title">
            <div className="flex items-start justify-between">
              <div>
                <h3 id="equipment-editor-title" className="text-lg font-semibold text-slate-900">{editingEquipment ? 'Edit Equipment' : 'Add Equipment'}</h3>
                <p className="mt-1 text-sm text-slate-600">Registration numbers must be unique per tenant.</p>
              </div>
              <button type="button" onClick={closeEditor} aria-label="Close equipment editor" className="text-2xl text-slate-500">×</button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); if (canManageEquipment && formValid) saveEquipment() }}>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Name</span>
                <input disabled={!canManageEquipment} value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
              </label>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Registration number</span>
                <input disabled={!canManageEquipment} value={form.registrationNumber} onChange={(event) => setForm((value) => ({ ...value, registrationNumber: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  <span>Make</span>
                  <input disabled={!canManageEquipment} value={form.make} onChange={(event) => setForm((value) => ({ ...value, make: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
                </label>
                <label className="space-y-1 text-sm font-medium text-slate-700">
                  <span>Model</span>
                  <input disabled={!canManageEquipment} value={form.model} onChange={(event) => setForm((value) => ({ ...value, model: event.target.value }))} className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100" />
                </label>
              </div>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Current site</span>
                <select disabled={!canManageEquipment} value={form.currentSiteId ?? ''} onChange={(event) => setForm((value) => ({ ...value, currentSiteId: event.target.value }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100">
                  <option value="">Unassigned</option>
                  {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Status</span>
                <select disabled={!canManageEquipment} value={form.status} onChange={(event) => setForm((value) => ({ ...value, status: event.target.value as EquipmentStatus }))} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100">
                  {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              {feedback?.kind === 'error' ? <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{feedback.message}</p> : null}
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={closeEditor} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                <button type="submit" disabled={!canManageEquipment || !formValid || isSaving} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Equipment'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default EquipmentPage
