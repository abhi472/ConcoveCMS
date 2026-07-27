import { useDeferredValue, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchInventoryBalances } from '../api/inventoryService'
import { fetchSiteMaterials } from '../api/siteMaterialService'
import { fetchPurchaseOrders } from '../api/purchaseOrdersService'
import { fetchTransactionHistory } from '../api/transactionHistoryService'
import { fetchAuditEvents } from '../api/auditService'
import {
  archiveEntity,
  createEntity,
  fetchEntities,
  fetchEntitySites,
  formatEntityError,
  removeEntitySite,
  restoreEntity,
  saveEntitySite,
  updateEntity,
  type EntityInput,
  type ManagedEntity,
} from '../api/entitiesService'
import { auditEventsQueryKey, entitiesQueryKey, entitySitesQueryKey, inventoryBalancesQueryKey, purchaseOrdersQueryKey, siteMaterialsQueryKey, transactionsQueryKey } from '../api/queryKeys'
import { useTenantContext } from '../context/TenantContext'
import type { EntityType } from '../types/schema'

const entityTypes: Array<{ value: EntityType; label: string }> = [
  { value: 'INTERNAL_SITE', label: 'Sites' },
  { value: 'VENDOR', label: 'Vendors' },
  { value: 'EMPLOYEE', label: 'Employees' },
  { value: 'SUBCONTRACTOR', label: 'Subcontractors' },
]

const emptyForm: EntityInput = {
  entityType: 'INTERNAL_SITE',
  name: '',
  locationCode: '',
  address: '',
  managerName: '',
  capacityNotes: '',
  contactName: '',
  phone: '',
  gstNumber: '',
  employeeCode: '',
  designation: '',
  specialty: '',
  registrationNumber: '',
}

const profileFields: Record<EntityType, Array<{ key: keyof EntityInput; label: string; multiline?: boolean }>> = {
  INTERNAL_SITE: [
    { key: 'locationCode', label: 'Location code' },
    { key: 'address', label: 'Address', multiline: true },
    { key: 'managerName', label: 'Manager' },
    { key: 'capacityNotes', label: 'Capacity notes', multiline: true },
  ],
  VENDOR: [
    { key: 'contactName', label: 'Contact name' },
    { key: 'phone', label: 'Phone' },
    { key: 'gstNumber', label: 'GST number' },
    { key: 'address', label: 'Address', multiline: true },
  ],
  EMPLOYEE: [
    { key: 'employeeCode', label: 'Employee code' },
    { key: 'designation', label: 'Designation' },
    { key: 'phone', label: 'Phone' },
  ],
  SUBCONTRACTOR: [
    { key: 'contactName', label: 'Contact name' },
    { key: 'phone', label: 'Phone' },
    { key: 'specialty', label: 'Specialty' },
    { key: 'registrationNumber', label: 'Registration number' },
    { key: 'address', label: 'Address', multiline: true },
  ],
}

function formFromEntity(entity: ManagedEntity): EntityInput {
  return {
    entityType: entity.entity_type,
    name: entity.name,
    locationCode: entity.location_code ?? '',
    address: entity.address ?? '',
    managerName: entity.manager_name ?? '',
    capacityNotes: entity.capacity_notes ?? '',
    contactName: entity.contact_name ?? '',
    phone: entity.phone ?? '',
    gstNumber: entity.gst_number ?? '',
    employeeCode: entity.employee_code ?? '',
    designation: entity.designation ?? '',
    specialty: entity.specialty ?? '',
    registrationNumber: entity.registration_number ?? '',
  }
}

function profileSummary(entity: ManagedEntity) {
  if (entity.entity_type === 'INTERNAL_SITE') return entity.location_code || entity.manager_name || 'Site profile'
  if (entity.entity_type === 'VENDOR') return entity.contact_name || entity.gst_number || 'Vendor profile'
  if (entity.entity_type === 'EMPLOYEE') return entity.employee_code || entity.designation || 'Employee profile'
  return entity.specialty || entity.registration_number || 'Subcontractor profile'
}

function EntitiesPage() {
  const queryClient = useQueryClient()
  const { selectedTenantId, selectedTenantName } = useTenantContext()
  const [entityType, setEntityType] = useState<EntityType>('INTERNAL_SITE')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active')
  const [page, setPage] = useState(1)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingEntity, setEditingEntity] = useState<ManagedEntity | null>(null)
  const [form, setForm] = useState<EntityInput>(emptyForm)
  const [isDirty, setIsDirty] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<ManagedEntity | null>(null)
  const [associationTarget, setAssociationTarget] = useState<ManagedEntity | null>(null)
  const [detailsTarget, setDetailsTarget] = useState<ManagedEntity | null>(null)
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  const filters = { search: deferredSearch, entityType, status, page, pageSize: 50 }
  const entitiesQuery = useQuery({
    queryKey: entitiesQueryKey(selectedTenantId, filters),
    queryFn: () => fetchEntities({ tenantId: selectedTenantId, ...filters }),
    placeholderData: (previousData) => previousData,
  })
  const sitesQuery = useQuery({
    queryKey: entitiesQueryKey(selectedTenantId, { entityType: 'INTERNAL_SITE', status: 'active', pageSize: 200 }),
    queryFn: () => fetchEntities({ tenantId: selectedTenantId, entityType: 'INTERNAL_SITE', status: 'active', pageSize: 200 }),
    enabled: Boolean(associationTarget),
  })
  const associationsQuery = useQuery({
    queryKey: entitySitesQueryKey(selectedTenantId, associationTarget?.id ?? ''),
    queryFn: () => fetchEntitySites(selectedTenantId, associationTarget!.id),
    enabled: Boolean(associationTarget),
  })
  const detailsAssociationsQuery = useQuery({
    queryKey: entitySitesQueryKey(selectedTenantId, detailsTarget?.id ?? ''),
    queryFn: () => fetchEntitySites(selectedTenantId, detailsTarget!.id),
    enabled: Boolean(detailsTarget && detailsTarget.entity_type !== 'INTERNAL_SITE'),
  })
  const detailsAssignmentsQuery = useQuery({
    queryKey: siteMaterialsQueryKey(selectedTenantId, detailsTarget?.entity_type === 'INTERNAL_SITE' ? detailsTarget.id : undefined),
    queryFn: () => fetchSiteMaterials(selectedTenantId, detailsTarget!.id),
    enabled: detailsTarget?.entity_type === 'INTERNAL_SITE',
  })
  const detailsBalancesQuery = useQuery({
    queryKey: inventoryBalancesQueryKey(selectedTenantId, detailsTarget?.entity_type === 'INTERNAL_SITE' ? detailsTarget.id : undefined),
    queryFn: () => fetchInventoryBalances({ tenantId: selectedTenantId, siteId: detailsTarget!.id }),
    enabled: detailsTarget?.entity_type === 'INTERNAL_SITE',
  })
  const detailsOrdersQuery = useQuery({
    queryKey: purchaseOrdersQueryKey(selectedTenantId, { entityId: detailsTarget?.id, entityType: detailsTarget?.entity_type }),
    queryFn: () => fetchPurchaseOrders(selectedTenantId, detailsTarget?.entity_type === 'VENDOR'
      ? { vendorId: detailsTarget.id }
      : { siteId: detailsTarget!.id }),
    enabled: detailsTarget?.entity_type === 'INTERNAL_SITE' || detailsTarget?.entity_type === 'VENDOR',
  })
  const detailsTransactionsQuery = useQuery({
    queryKey: transactionsQueryKey(selectedTenantId, { siteId: detailsTarget?.id, pageSize: 5 }),
    queryFn: () => fetchTransactionHistory({ tenantId: selectedTenantId, siteId: detailsTarget!.id, pageSize: 5 }),
    enabled: detailsTarget?.entity_type === 'INTERNAL_SITE',
  })
  const detailsAuditQuery = useQuery({
    queryKey: auditEventsQueryKey(selectedTenantId, { resourceType: 'ENTITY', resourceId: detailsTarget?.id }),
    queryFn: () => fetchAuditEvents({ tenantId: selectedTenantId, resourceType: 'ENTITY', resourceId: detailsTarget!.id, pageSize: 10 }),
    enabled: Boolean(detailsTarget),
  })

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isDirty])

  async function invalidateEntityData(entityId?: string) {
    const invalidations = [
      queryClient.invalidateQueries({ queryKey: ['entities', selectedTenantId] }),
      queryClient.invalidateQueries({ queryKey: ['master-data', selectedTenantId] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard', selectedTenantId] }),
    ]
    if (entityId) invalidations.push(queryClient.invalidateQueries({ queryKey: entitySitesQueryKey(selectedTenantId, entityId) }))
    await Promise.all(invalidations)
  }

  function openCreate() {
    setEditingEntity(null)
    setForm({ ...emptyForm, entityType })
    setFeedback(null)
    setIsDirty(false)
    setIsEditorOpen(true)
  }

  function openEdit(entity: ManagedEntity) {
    setEditingEntity(entity)
    setForm(formFromEntity(entity))
    setFeedback(null)
    setIsDirty(false)
    setIsEditorOpen(true)
  }

  function closeEditor() {
    if (isDirty && !window.confirm('Discard unsaved entity changes?')) return
    setIsEditorOpen(false)
    setEditingEntity(null)
    setIsDirty(false)
  }

  const saveMutation = useMutation({
    mutationFn: () => editingEntity
      ? updateEntity(selectedTenantId, editingEntity.id, form)
      : createEntity(selectedTenantId, form),
    onSuccess: async (entity) => {
      setFeedback({ kind: 'success', message: `${entity.name} ${editingEntity ? 'updated' : 'created'}.` })
      setIsDirty(false)
      setIsEditorOpen(false)
      setEditingEntity(null)
      await invalidateEntityData(entity.id)
    },
    onError: (error) => setFeedback({ kind: 'error', message: formatEntityError(error) }),
  })
  const archiveMutation = useMutation({
    mutationFn: (entity: ManagedEntity) => archiveEntity(selectedTenantId, entity.id),
    onSuccess: async (entity) => {
      setArchiveTarget(null)
      setFeedback({ kind: 'success', message: `${entity.name} archived.` })
      await invalidateEntityData(entity.id)
    },
    onError: (error) => setFeedback({ kind: 'error', message: formatEntityError(error) }),
  })
  const restoreMutation = useMutation({
    mutationFn: (entity: ManagedEntity) => restoreEntity(selectedTenantId, entity.id),
    onSuccess: async (entity) => {
      setFeedback({ kind: 'success', message: `${entity.name} restored.` })
      await invalidateEntityData(entity.id)
    },
    onError: (error) => setFeedback({ kind: 'error', message: formatEntityError(error) }),
  })
  const saveAssociationMutation = useMutation({
    mutationFn: ({ siteId, isPrimary }: { siteId: string; isPrimary: boolean }) => saveEntitySite({
      tenantId: selectedTenantId,
      entityId: associationTarget!.id,
      siteId,
      isPrimary,
    }),
    onSuccess: async () => {
      setFeedback({ kind: 'success', message: 'Site association saved.' })
      await invalidateEntityData(associationTarget!.id)
    },
    onError: (error) => setFeedback({ kind: 'error', message: formatEntityError(error) }),
  })
  const removeAssociationMutation = useMutation({
    mutationFn: (siteId: string) => removeEntitySite(selectedTenantId, associationTarget!.id, siteId),
    onSuccess: async () => {
      setFeedback({ kind: 'success', message: 'Site association ended.' })
      await invalidateEntityData(associationTarget!.id)
    },
    onError: (error) => setFeedback({ kind: 'error', message: formatEntityError(error) }),
  })

  const entities = entitiesQuery.data?.data ?? []
  const total = entitiesQuery.data?.pagination.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / 50))
  const associations = associationsQuery.data ?? []

  return (
    <section className="space-y-4">
      <header className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Entities</h2>
          <p className="mt-1 text-sm text-slate-600">Sites, vendors, employees, subcontractors, and their operating relationships.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{selectedTenantName}</span>
          <button type="button" onClick={openCreate} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Add {entityTypes.find((item) => item.value === entityType)?.label.slice(0, -1)}</button>
        </div>
      </header>

      <div className="border-b border-slate-200">
        <div className="flex overflow-x-auto">
          {entityTypes.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => { setEntityType(item.value); setPage(1); setFeedback(null) }}
              className={`border-b-2 px-4 py-3 text-sm font-semibold ${entityType === item.value ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 bg-white px-4 py-3 md:grid-cols-[minmax(14rem,1fr)_12rem]">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Search</span>
          <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Name" className="w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          <span>Status</span>
          <select value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1) }} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2"><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select>
        </label>
      </div>

      {feedback ? <div className={`border px-4 py-3 text-sm ${feedback.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{feedback.message}</div> : null}
      {entitiesQuery.isLoading ? <div className="flex min-h-64 items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" /></div> : null}
      {entitiesQuery.isError ? <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{formatEntityError(entitiesQuery.error)}</div> : null}
      {!entitiesQuery.isLoading && !entitiesQuery.isError && entities.length === 0 ? <div className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No records match these filters.</div> : null}

      {entities.length > 0 ? <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50"><tr><th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th><th className="px-4 py-3 text-left font-semibold text-slate-600">Profile</th><th className="px-4 py-3 text-left font-semibold text-slate-600">Contact</th><th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th><th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{entities.map((entity) => <tr key={entity.id} className={entity.archived_at ? 'bg-slate-50 text-slate-500' : 'hover:bg-slate-50'}>
            <td className="px-4 py-3 font-medium text-slate-900">{entity.name}</td><td className="px-4 py-3 text-slate-600">{profileSummary(entity)}</td><td className="px-4 py-3 text-slate-600">{entity.phone || entity.address || '—'}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${entity.archived_at ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-800'}`}>{entity.archived_at ? 'Archived' : 'Active'}</span></td>
            <td className="px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => setDetailsTarget(entity)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Details</button>{!entity.archived_at ? <><button type="button" onClick={() => openEdit(entity)} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Edit</button>{entity.entity_type !== 'INTERNAL_SITE' ? <button type="button" onClick={() => { setFeedback(null); setAssociationTarget(entity) }} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Sites</button> : null}<button type="button" onClick={() => { setFeedback(null); setArchiveTarget(entity) }} className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700">Archive</button></> : <button type="button" disabled={restoreMutation.isPending} onClick={() => restoreMutation.mutate(entity)} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Restore</button>}</div></td>
          </tr>)}</tbody>
        </table></div>
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600"><span>{total.toLocaleString()} records</span><div className="flex items-center gap-3"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40">Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)} className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
      </div> : null}

      {isEditorOpen ? <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor() }}><div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="entity-editor-title">
        <div className="flex items-start justify-between"><div><h3 id="entity-editor-title" className="text-lg font-semibold text-slate-900">{editingEntity ? 'Edit' : 'Add'} {entityTypes.find((item) => item.value === form.entityType)?.label.slice(0, -1)}</h3><p className="mt-1 text-sm text-slate-600">Profile fields adapt to the selected entity type.</p></div><button type="button" onClick={closeEditor} aria-label="Close entity editor" className="text-2xl text-slate-500">×</button></div>
        <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); if (form.name.trim()) saveMutation.mutate() }}>
          {!editingEntity ? <label className="block space-y-1 text-sm font-medium text-slate-700"><span>Type</span><select value={form.entityType} onChange={(event) => { setForm({ ...emptyForm, entityType: event.target.value as EntityType }); setIsDirty(true) }} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">{entityTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label> : null}
          <label className="block space-y-1 text-sm font-medium text-slate-700"><span>Name</span><input value={form.name} onChange={(event) => { setForm((value) => ({ ...value, name: event.target.value })); setIsDirty(true) }} className="w-full rounded-md border border-slate-300 px-3 py-2" /></label>
          {profileFields[form.entityType].map((field) => <label key={field.key} className="block space-y-1 text-sm font-medium text-slate-700"><span>{field.label}</span>{field.multiline ? <textarea value={String(form[field.key])} onChange={(event) => { setForm((value) => ({ ...value, [field.key]: event.target.value })); setIsDirty(true) }} rows={3} className="w-full rounded-md border border-slate-300 px-3 py-2" /> : <input value={String(form[field.key])} onChange={(event) => { setForm((value) => ({ ...value, [field.key]: event.target.value })); setIsDirty(true) }} className="w-full rounded-md border border-slate-300 px-3 py-2" />}</label>)}
          {feedback?.kind === 'error' ? <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{feedback.message}</p> : null}
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={closeEditor} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button><button type="submit" disabled={!form.name.trim() || saveMutation.isPending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saveMutation.isPending ? 'Saving...' : 'Save'}</button></div>
        </form>
      </div></div> : null}

      {detailsTarget ? <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailsTarget(null) }}><div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="entity-details-title">
        <div className="flex items-start justify-between gap-4"><div><h3 id="entity-details-title" className="text-lg font-semibold text-slate-900">{detailsTarget.name}</h3><p className="mt-1 text-sm text-slate-600">{detailsTarget.entity_type.replace('_', ' ')} · {detailsTarget.archived_at ? 'Archived' : 'Active'}</p></div><button type="button" onClick={() => setDetailsTarget(null)} aria-label="Close entity details" className="text-2xl text-slate-500">×</button></div>
        <dl className="mt-5 grid gap-3 border-y border-slate-200 py-4 text-sm sm:grid-cols-2">{profileFields[detailsTarget.entity_type].map((field) => {
          const apiKey = field.key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`) as keyof ManagedEntity
          return <div key={field.key}><dt className="text-xs text-slate-500">{field.label}</dt><dd className="font-medium text-slate-900">{String(detailsTarget[apiKey] ?? '—')}</dd></div>
        })}</dl>
        <div className="mt-4 flex flex-wrap gap-2">{detailsTarget.entity_type === 'INTERNAL_SITE' ? <><Link to={`/site-materials?site=${detailsTarget.id}`} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Manage materials</Link><Link to={`/dashboard?site=${detailsTarget.id}`} className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white">Open dashboard</Link><Link to={`/operations?mode=ledger&site=${detailsTarget.id}`} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Record movement</Link></> : <button type="button" onClick={() => { setDetailsTarget(null); setAssociationTarget(detailsTarget) }} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Manage sites</button>}</div>
        <div className="mt-6 space-y-5 text-sm">
          {detailsTarget.entity_type === 'INTERNAL_SITE' ? <section><h4 className="font-semibold text-slate-900">Stock exceptions</h4><p className="mt-1 text-xs text-slate-500">{(detailsAssignmentsQuery.data ?? []).filter((item) => item.is_active).length} assigned materials</p><div className="mt-2 space-y-2">{(detailsBalancesQuery.data?.data ?? []).filter((balance) => balance.status !== 'OK').slice(0, 8).map((balance) => <div key={balance.material_id} className="flex justify-between border-b border-slate-100 pb-2"><span>{balance.material_code}</span><span>{balance.quantity_base_uom.toLocaleString()} {balance.base_uom_id} · {balance.status}</span></div>)}{!detailsBalancesQuery.isLoading && !(detailsBalancesQuery.data?.data ?? []).some((balance) => balance.status !== 'OK') ? <p className="text-slate-500">No stock exceptions.</p> : null}</div></section> : null}
          {detailsTarget.entity_type !== 'INTERNAL_SITE' ? <section><h4 className="font-semibold text-slate-900">Site relationships</h4><div className="mt-2 space-y-2">{detailsAssociationsQuery.data?.filter((item) => item.is_active).map((association) => <div key={association.id} className="flex justify-between border-b border-slate-100 pb-2"><span>{association.site_name}</span><span>{association.is_primary ? 'Primary' : association.association_type}</span></div>)}{!detailsAssociationsQuery.isLoading && !detailsAssociationsQuery.data?.some((item) => item.is_active) ? <p className="text-slate-500">No active site relationships.</p> : null}</div></section> : null}
          {(detailsTarget.entity_type === 'INTERNAL_SITE' || detailsTarget.entity_type === 'VENDOR') ? <section><h4 className="font-semibold text-slate-900">Open purchase orders</h4><div className="mt-2 space-y-2">{(detailsOrdersQuery.data?.data ?? []).filter((order) => order.status !== 'COMPLETED').slice(0, 5).map((order) => <div key={order.id} className="flex justify-between border-b border-slate-100 pb-2"><span>{order.po_number} · {detailsTarget.entity_type === 'VENDOR' ? order.target_site_name : order.vendor_name}</span><span>{Number(order.open_quantity_base_uom).toLocaleString()} open</span></div>)}{!detailsOrdersQuery.isLoading && !(detailsOrdersQuery.data?.data ?? []).some((order) => order.status !== 'COMPLETED') ? <p className="text-slate-500">No open purchase orders.</p> : null}</div></section> : null}
          {detailsTarget.entity_type === 'INTERNAL_SITE' ? <section><h4 className="font-semibold text-slate-900">Recent movements</h4><div className="mt-2 space-y-2">{detailsTransactionsQuery.data?.data.map((transaction) => <div key={transaction.id} className="flex justify-between border-b border-slate-100 pb-2"><span>{transaction.material_code} · {transaction.transaction_type}</span><span>{Number(transaction.quantity).toLocaleString()} {transaction.quantity_uom}</span></div>)}</div></section> : null}
          <section><h4 className="font-semibold text-slate-900">Audit timeline</h4><div className="mt-2 space-y-2">{detailsAuditQuery.data?.data.map((event) => <div key={event.id} className="flex justify-between border-b border-slate-100 pb-2"><span>{event.action} · {event.actor_id}</span><time className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString()}</time></div>)}{!detailsAuditQuery.isLoading && detailsAuditQuery.data?.data.length === 0 ? <p className="text-slate-500">No audit events recorded.</p> : null}</div></section>
        </div>
      </div></div> : null}

      {associationTarget ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl" role="dialog" aria-modal="true"><div className="flex items-start justify-between"><div><h3 className="text-lg font-semibold text-slate-900">Sites for {associationTarget.name}</h3><p className="mt-1 text-sm text-slate-600">{associationTarget.entity_type === 'VENDOR' ? 'Preferred sites improve defaults but do not restrict vendor use.' : 'People may work across several sites with one primary site.'}</p></div><button type="button" onClick={() => setAssociationTarget(null)} aria-label="Close site associations" className="text-2xl text-slate-500">×</button></div>
        {feedback?.kind === 'error' ? <p className="mt-3 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{feedback.message}</p> : null}
        <div className="mt-4 max-h-96 overflow-y-auto border border-slate-200"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr><th className="px-3 py-2 text-left">Site</th><th className="px-3 py-2 text-left">Relationship</th><th className="px-3 py-2 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{(sitesQuery.data?.data ?? []).map((site) => {
          const association = associations.find((item) => item.site_id === site.id && item.is_active)
          const isPerson = associationTarget.entity_type !== 'VENDOR'
          return <tr key={site.id}><td className="px-3 py-3 font-medium text-slate-900">{site.name}</td><td className="px-3 py-3 text-slate-600">{association ? association.is_primary ? 'Primary' : association.association_type === 'PREFERRED' ? 'Preferred' : 'Assigned' : 'Not linked'}</td><td className="px-3 py-3"><div className="flex justify-end gap-2">{association ? <>{isPerson && !association.is_primary ? <button type="button" onClick={() => saveAssociationMutation.mutate({ siteId: site.id, isPrimary: true })} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold">Make primary</button> : null}<button type="button" onClick={() => removeAssociationMutation.mutate(site.id)} className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700">Remove</button></> : <button type="button" onClick={() => saveAssociationMutation.mutate({ siteId: site.id, isPrimary: false })} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">{isPerson ? 'Assign' : 'Prefer'}</button>}</div></td></tr>
        })}</tbody></table></div>
        {associationsQuery.isLoading || sitesQuery.isLoading ? <p className="mt-3 text-sm text-slate-500">Loading sites...</p> : null}
      </div></div> : null}

      {archiveTarget ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" role="alertdialog" aria-modal="true"><h3 className="text-lg font-semibold text-slate-900">Archive {archiveTarget.name}?</h3><p className="mt-2 text-sm text-slate-600">Historical references remain readable. Current stock, open purchase orders, or active site relationships may block this action.</p>{feedback?.kind === 'error' ? <p className="mt-3 border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{feedback.message}</p> : null}<div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setArchiveTarget(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button type="button" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate(archiveTarget)} className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Archive</button></div></div></div> : null}
    </section>
  )
}

export default EntitiesPage