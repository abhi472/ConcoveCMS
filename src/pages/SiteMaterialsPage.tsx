import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { fetchMasterData } from '../api/masterDataService'
import { inventoryDashboardQueryKey, masterDataQueryKey, siteMaterialsQueryKey } from '../api/queryKeys'
import {
  bulkUpdateSiteMaterialAssignments,
  fetchSiteMaterials,
  formatAssignmentError,
  removeSiteMaterialAssignment,
  saveSiteMaterialAssignment,
  type SiteMaterialAssignment,
} from '../api/siteMaterialService'
import { useAuthContext } from '../context/useAuthContext'
import { useTenantContext } from '../context/useTenantContext'
import { hasRequiredRole } from '../types/rbac'

type SaveInput = {
  assignment: SiteMaterialAssignment
  lowStockThreshold: number
  criticalStockThreshold: number
}

function AssignmentRow({
  assignment,
  isPending,
  canManage,
  onSave,
  onRemove,
  selected,
  onSelectedChange,
}: {
  assignment: SiteMaterialAssignment
  isPending: boolean
  canManage: boolean
  onSave: (input: SaveInput) => void
  onRemove: (assignment: SiteMaterialAssignment) => void
  selected: boolean
  onSelectedChange: (selected: boolean) => void
}) {
  const [lowThreshold, setLowThreshold] = useState(assignment.low_stock_threshold)
  const [criticalThreshold, setCriticalThreshold] = useState(assignment.critical_stock_threshold)

  const low = Number(lowThreshold)
  const critical = Number(criticalThreshold)
  const invalidThresholds = !Number.isFinite(low) || !Number.isFinite(critical) || low < 0 || critical < 0 || critical > low

  return (
    <tr className={assignment.is_active ? 'bg-white' : 'bg-slate-50 text-slate-500'}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          aria-label={`Select ${assignment.material_code}`}
          checked={selected}
          disabled={!canManage}
          onChange={(event) => onSelectedChange(event.target.checked)}
        />
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{assignment.material_code}</p>
        <p className="mt-0.5 text-xs text-slate-500">{assignment.material_description}</p>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{assignment.base_uom_id}</td>
      <td className="px-4 py-3">
        <input
          aria-label={`Low threshold for ${assignment.material_code}`}
          type="number"
          min="0"
          step="0.000001"
          value={lowThreshold}
          onChange={(event) => setLowThreshold(event.target.value)}
          className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-100"
          disabled={!canManage || !assignment.is_active || isPending}
        />
      </td>
      <td className="px-4 py-3">
        <input
          aria-label={`Critical threshold for ${assignment.material_code}`}
          type="number"
          min="0"
          step="0.000001"
          value={criticalThreshold}
          onChange={(event) => setCriticalThreshold(event.target.value)}
          className="w-28 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 disabled:bg-slate-100"
          disabled={!canManage || !assignment.is_active || isPending}
        />
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${assignment.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
          {assignment.is_active ? 'Assigned' : 'Unassigned'}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          {assignment.is_active ? (
            <>
              <button
                type="button"
                disabled={!canManage || invalidThresholds || isPending}
                onClick={() => onSave({ assignment, lowStockThreshold: low, criticalStockThreshold: critical })}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                disabled={!canManage || isPending}
                onClick={() => onRemove(assignment)}
                className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                Unassign
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={!canManage || isPending}
              onClick={() => onSave({ assignment, lowStockThreshold: low, criticalStockThreshold: critical })}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Assign
            </button>
          )}
        </div>
        {invalidThresholds ? <p className="mt-1 text-xs text-rose-700">Critical must not exceed low.</p> : null}
      </td>
    </tr>
  )
}

function SiteMaterialsPage() {
  const queryClient = useQueryClient()
  const { user } = useAuthContext()
  const [searchParams] = useSearchParams()
  const { selectedTenantId, selectedTenantName } = useTenantContext()
  const [siteSelection, setSiteSelection] = useState('')
  const [search, setSearch] = useState(() => searchParams.get('material') ?? '')
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(() => new Set())

  const masterDataQuery = useQuery({
    queryKey: masterDataQueryKey(selectedTenantId),
    queryFn: () => fetchMasterData({ tenantId: selectedTenantId }),
  })
  const sites = (masterDataQuery.data?.data.entities ?? []).filter((entity) => entity.entity_type === 'INTERNAL_SITE')
  const selectedSiteId = sites.some((site) => site.id === siteSelection)
    ? siteSelection
    : sites[0]?.id ?? ''

  const assignmentsQuery = useQuery({
    queryKey: siteMaterialsQueryKey(selectedTenantId, selectedSiteId),
    queryFn: () => fetchSiteMaterials(selectedTenantId, selectedSiteId),
    enabled: Boolean(selectedSiteId),
  })

  async function refreshAssignments() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: siteMaterialsQueryKey(selectedTenantId, selectedSiteId) }),
      queryClient.invalidateQueries({ queryKey: inventoryDashboardQueryKey(selectedTenantId, selectedSiteId) }),
      queryClient.invalidateQueries({ queryKey: inventoryDashboardQueryKey(selectedTenantId) }),
    ])
  }

  const saveMutation = useMutation({
    mutationFn: (input: SaveInput) => saveSiteMaterialAssignment({
      tenantId: selectedTenantId,
      siteId: input.assignment.site_id,
      materialId: input.assignment.material_id,
      lowStockThreshold: input.lowStockThreshold,
      criticalStockThreshold: input.criticalStockThreshold,
    }),
    onSuccess: async () => {
      setFeedback({ kind: 'success', message: 'Assignment saved.' })
      await refreshAssignments()
    },
    onError: (error) => setFeedback({ kind: 'error', message: formatAssignmentError(error) }),
  })

  const removeMutation = useMutation({
    mutationFn: (assignment: SiteMaterialAssignment) => removeSiteMaterialAssignment({
      tenantId: selectedTenantId,
      siteId: assignment.site_id,
      materialId: assignment.material_id,
    }),
    onSuccess: async () => {
      setFeedback({ kind: 'success', message: 'Material unassigned from site.' })
      await refreshAssignments()
    },
    onError: (error) => setFeedback({ kind: 'error', message: formatAssignmentError(error) }),
  })

  const bulkMutation = useMutation({
    mutationFn: (action: 'ASSIGN' | 'UNASSIGN') => bulkUpdateSiteMaterialAssignments({
      tenantId: selectedTenantId,
      items: (assignmentsQuery.data ?? [])
        .filter((assignment) => selectedMaterialIds.has(assignment.material_id))
        .map((assignment) => ({
          siteId: assignment.site_id,
          materialId: assignment.material_id,
          action,
          lowStockThreshold: Number(assignment.low_stock_threshold),
          criticalStockThreshold: Number(assignment.critical_stock_threshold),
        })),
    }),
    onSuccess: async (_, action) => {
      const count = selectedMaterialIds.size
      setFeedback({ kind: 'success', message: `${count} material${count === 1 ? '' : 's'} ${action === 'ASSIGN' ? 'assigned' : 'unassigned'}.` })
      setSelectedMaterialIds(new Set())
      await refreshAssignments()
    },
    onError: (error) => setFeedback({ kind: 'error', message: formatAssignmentError(error) }),
  })

  const normalizedSearch = search.trim().toLowerCase()
  const canManageAssignments = Boolean(user && hasRequiredRole(user.role, ['ADMIN', 'SITE_MANAGER', 'OPERATOR']))
  const assignments = (assignmentsQuery.data ?? []).filter((assignment) =>
    !normalizedSearch ||
    assignment.material_code.toLowerCase().includes(normalizedSearch) ||
    assignment.material_description.toLowerCase().includes(normalizedSearch),
  )
  const pendingMaterialId = saveMutation.variables?.assignment.material_id ?? removeMutation.variables?.material_id

  return (
    <section className="space-y-4">
      <header className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Site Materials</h2>
          <p className="mt-1 text-sm text-slate-600">Control which materials are operationally relevant at each site.</p>
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{selectedTenantName}</p>
      </header>

      <div className="flex flex-col gap-3 border-y border-slate-200 bg-white px-4 py-3 md:flex-row md:items-end">
        <label className="min-w-64 space-y-1 text-sm font-medium text-slate-700">
          <span>Site</span>
          <select
            value={selectedSiteId}
            onChange={(event) => { setSiteSelection(event.target.value); setFeedback(null) }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
        </label>
        <label className="min-w-64 flex-1 space-y-1 text-sm font-medium text-slate-700">
          <span>Search materials</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Code or description"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="pb-2 text-sm text-slate-600">
          {assignments.filter((item) => item.is_active).length} assigned / {assignments.length} shown
        </div>
        {canManageAssignments && selectedMaterialIds.size > 0 ? (
          <div className="flex gap-2 pb-1">
            <button type="button" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate('ASSIGN')} className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Assign selected</button>
            <button type="button" disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate('UNASSIGN')} className="rounded-md border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-40">Unassign selected</button>
          </div>
        ) : null}
      </div>

      {!canManageAssignments ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Your role has read-only access for site-material assignments.
        </p>
      ) : null}

      {feedback ? (
        <div className={`border px-4 py-3 text-sm ${feedback.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
          {feedback.message}
        </div>
      ) : null}

      {masterDataQuery.isLoading || assignmentsQuery.isLoading ? (
        <div className="flex min-h-64 items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" /></div>
      ) : null}

      {masterDataQuery.isError || assignmentsQuery.isError ? (
        <div className="border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">Unable to load site-material assignments.</div>
      ) : null}

      {!masterDataQuery.isLoading && sites.length === 0 ? (
        <div className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">Create an active site before assigning materials.</div>
      ) : null}

      {!assignmentsQuery.isLoading && selectedSiteId && assignments.length === 0 ? (
        <div className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">No materials match this search.</div>
      ) : null}

      {assignments.length > 0 ? (
        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select all shown materials"
                      checked={assignments.length > 0 && assignments.every((item) => selectedMaterialIds.has(item.material_id))}
                      disabled={!canManageAssignments}
                      onChange={(event) => setSelectedMaterialIds((current) => {
                        const next = new Set(current)
                        assignments.forEach((item) => event.target.checked ? next.add(item.material_id) : next.delete(item.material_id))
                        return next
                      })}
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Material</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">UoM</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Low</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Critical</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.map((assignment) => (
                  <AssignmentRow
                    key={`${assignment.site_id}:${assignment.material_id}:${assignment.updated_at}:${assignment.is_active}`}
                    assignment={assignment}
                    isPending={(saveMutation.isPending || removeMutation.isPending) && pendingMaterialId === assignment.material_id}
                    canManage={canManageAssignments}
                    onSave={(input) => { setFeedback(null); saveMutation.mutate(input) }}
                    onRemove={(item) => { setFeedback(null); removeMutation.mutate(item) }}
                    selected={selectedMaterialIds.has(assignment.material_id)}
                    onSelectedChange={(selected) => setSelectedMaterialIds((current) => {
                      const next = new Set(current)
                      if (selected) next.add(assignment.material_id)
                      else next.delete(assignment.material_id)
                      return next
                    })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default SiteMaterialsPage