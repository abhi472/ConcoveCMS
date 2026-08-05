import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMasterData } from '../api/masterDataService'
import { masterDataQueryKey } from '../api/queryKeys'
import { useCreateAndDispatchSiteTransfer, useReceiveSiteTransfer, useSiteTransfers } from '../api/siteTransferQueries'
import { formatSiteTransferError, type ManagedSiteTransfer } from '../api/siteTransferService'
import { useAuthContext } from '../context/useAuthContext'
import { useTenantContext } from '../context/useTenantContext'
import { hasRequiredRole } from '../types/rbac'
import type { SiteTransferStatus } from '../types/schema'

type WorkspaceTab = 'outgoing' | 'in-transit' | 'incoming'

interface DispatchLineDraft {
  id: string
  materialId: string
  quantity: string
}

interface ReceiveLineDraft {
  materialId: string
  materialCode: string
  remaining: number
  quantity: string
  discrepancyReason: string
}

const STATUS_BADGE_STYLES: Record<SiteTransferStatus, string> = {
  DRAFT: 'bg-slate-200 text-slate-600',
  DISPATCHED: 'bg-sky-100 text-sky-800',
  PARTIAL_RECEIVED: 'bg-amber-100 text-amber-800',
  RECONCILED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-rose-100 text-rose-800',
}

const RECEIVABLE_STATUSES: SiteTransferStatus[] = ['DISPATCHED', 'PARTIAL_RECEIVED']

function emptyDispatchLine(): DispatchLineDraft {
  return { id: crypto.randomUUID(), materialId: '', quantity: '' }
}

function SiteTransfersPage() {
  const { user } = useAuthContext()
  const { selectedTenantId, selectedTenantName } = useTenantContext()
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('outgoing')
  const [mySiteId, setMySiteId] = useState('')

  const masterDataQuery = useQuery({
    queryKey: masterDataQueryKey(selectedTenantId),
    queryFn: () => fetchMasterData({ tenantId: selectedTenantId }),
  })
  const entities = masterDataQuery.data?.data.entities ?? []
  const materials = useMemo(
    () => (masterDataQuery.data?.data.materials ?? []).filter((material) => !material.archived_at),
    [masterDataQuery.data],
  )
  const sites = useMemo(() => entities.filter((entity) => entity.entity_type === 'INTERNAL_SITE'), [entities])
  const effectiveSiteId = mySiteId || sites[0]?.id || ''

  const outgoingQuery = useSiteTransfers({
    tenantId: selectedTenantId,
    sourceSiteId: effectiveSiteId,
    pageSize: 200,
  })
  const incomingQuery = useSiteTransfers({
    tenantId: selectedTenantId,
    destinationSiteId: effectiveSiteId,
    pageSize: 200,
  })

  const outgoingTransfers = outgoingQuery.data?.data ?? []
  const incomingTransfers = incomingQuery.data?.data ?? []
  const receivableIncomingTransfers = incomingTransfers.filter((transfer) =>
    RECEIVABLE_STATUSES.includes(transfer.transfer_status),
  )
  const inTransitTransfers = useMemo(() => {
    const merged = new Map<string, ManagedSiteTransfer>()
    for (const transfer of [...outgoingTransfers, ...incomingTransfers]) {
      if (RECEIVABLE_STATUSES.includes(transfer.transfer_status)) merged.set(transfer.id, transfer)
    }
    return Array.from(merged.values()).sort((a, b) => (a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1)
  }, [outgoingTransfers, incomingTransfers])

  const isLoading = effectiveSiteId
    ? (activeTab === 'outgoing' && outgoingQuery.isLoading)
      || (activeTab === 'incoming' && incomingQuery.isLoading)
      || (activeTab === 'in-transit' && (outgoingQuery.isLoading || incomingQuery.isLoading))
    : false

  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false)
  const [destinationSiteId, setDestinationSiteId] = useState('')
  const [dispatchLines, setDispatchLines] = useState<DispatchLineDraft[]>([emptyDispatchLine()])
  const [dispatchFeedback, setDispatchFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const createMutation = useCreateAndDispatchSiteTransfer(selectedTenantId)

  const [receivingTransfer, setReceivingTransfer] = useState<ManagedSiteTransfer | null>(null)
  const [receiveLines, setReceiveLines] = useState<ReceiveLineDraft[]>([])
  const [receiveFeedback, setReceiveFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)
  const receiveMutation = useReceiveSiteTransfer(selectedTenantId)

  function openDispatchModal() {
    setDestinationSiteId('')
    setDispatchLines([emptyDispatchLine()])
    setDispatchFeedback(null)
    setIsDispatchModalOpen(true)
  }

  function closeDispatchModal() {
    setIsDispatchModalOpen(false)
  }

  function updateDispatchLine(id: string, patch: Partial<DispatchLineDraft>) {
    setDispatchLines((lines) => lines.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  }

  function addDispatchLine() {
    setDispatchLines((lines) => [...lines, emptyDispatchLine()])
  }

  function removeDispatchLine(id: string) {
    setDispatchLines((lines) => (lines.length > 1 ? lines.filter((line) => line.id !== id) : lines))
  }

  const dispatchFormValid = Boolean(
    effectiveSiteId
    && destinationSiteId
    && destinationSiteId !== effectiveSiteId
    && dispatchLines.every((line) => line.materialId && Number(line.quantity) > 0),
  )

  function submitDispatch() {
    createMutation.mutate({
      sourceSiteId: effectiveSiteId,
      destinationSiteId,
      lines: dispatchLines.map((line) => ({
        materialId: line.materialId,
        quantityDispatched: Number(line.quantity),
        clientTransactionId: crypto.randomUUID(),
      })),
    }, {
      onSuccess: () => {
        setDispatchFeedback({ kind: 'success', message: 'Transfer dispatched successfully.' })
        closeDispatchModal()
      },
      onError: (error) => setDispatchFeedback({ kind: 'error', message: formatSiteTransferError(error) }),
    })
  }

  function openReceiveModal(transfer: ManagedSiteTransfer) {
    setReceivingTransfer(transfer)
    setReceiveFeedback(null)
    setReceiveLines((transfer.lines ?? []).map((line) => {
      const remaining = Number(line.quantity_dispatched) - Number(line.quantity_received)
      return {
        materialId: line.material_id,
        materialCode: line.material_code,
        remaining,
        quantity: remaining > 0 ? String(remaining) : '0',
        discrepancyReason: '',
      }
    }))
  }

  function closeReceiveModal() {
    setReceivingTransfer(null)
    setReceiveLines([])
  }

  function updateReceiveLine(materialId: string, patch: Partial<ReceiveLineDraft>) {
    setReceiveLines((lines) => lines.map((line) => (line.materialId === materialId ? { ...line, ...patch } : line)))
  }

  const receiveFormValid = receiveLines.some((line) => Number(line.quantity) > 0)
    && receiveLines.every((line) => Number(line.quantity) >= 0 && Number(line.quantity) <= line.remaining)

  function submitReceive() {
    if (!receivingTransfer) return
    const lines = receiveLines
      .filter((line) => Number(line.quantity) > 0)
      .map((line) => ({
        materialId: line.materialId,
        quantityReceived: Number(line.quantity),
        discrepancyReason: line.discrepancyReason.trim() || null,
        clientTransactionId: crypto.randomUUID(),
      }))
    receiveMutation.mutate({ siteTransferId: receivingTransfer.id, lines }, {
      onSuccess: () => {
        setReceiveFeedback({ kind: 'success', message: 'Shipment reconciled successfully.' })
        closeReceiveModal()
      },
      onError: (error) => setReceiveFeedback({ kind: 'error', message: formatSiteTransferError(error) }),
    })
  }

  const activeTransfers = activeTab === 'outgoing'
    ? outgoingTransfers
    : activeTab === 'incoming'
      ? receivableIncomingTransfers
      : inTransitTransfers
  const canManageTransfers = Boolean(user && hasRequiredRole(user.role, ['ADMIN', 'SITE_MANAGER', 'OPERATOR']))

  return (
    <section className="space-y-4">
      <header className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Site-to-Site Transfers</h2>
          <p className="mt-1 text-sm text-slate-600">
            Dispatch, track, and reconcile inter-site material movements.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{selectedTenantName}</span>
          <button
            type="button"
            onClick={openDispatchModal}
            disabled={!canManageTransfers || !effectiveSiteId}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Dispatch Transfer
          </button>
        </div>
      </header>

      {!canManageTransfers ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Your role has read-only access for transfer dispatch and receiving actions.
        </p>
      ) : null}

      <div className="border-y border-slate-200 bg-white px-4 py-3">
        <label className="block max-w-xs space-y-1 text-sm font-medium text-slate-700">
          <span>My Site</span>
          <select
            value={effectiveSiteId}
            onChange={(event) => setMySiteId(event.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
        </label>
      </div>

      {dispatchFeedback ? (
        <div className={`border px-4 py-3 text-sm ${dispatchFeedback.kind === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
        >
          {dispatchFeedback.message}
        </div>
      ) : null}
      {receiveFeedback ? (
        <div className={`border px-4 py-3 text-sm ${receiveFeedback.kind === 'error'
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
        >
          {receiveFeedback.message}
        </div>
      ) : null}

      <div className="flex gap-2 border-b border-slate-200">
        {([
          { key: 'outgoing', label: 'Outgoing Shipments' },
          { key: 'in-transit', label: 'In-Transit' },
          { key: 'incoming', label: 'Incoming / Ready to Receive' },
        ] as Array<{ key: WorkspaceTab; label: string }>).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-semibold ${activeTab === tab.key
              ? 'border-b-2 border-slate-900 text-slate-900'
              : 'text-slate-500 hover:text-slate-800'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
        </div>
      ) : null}

      {!isLoading && effectiveSiteId && activeTransfers.length === 0 ? (
        <div className="border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          No transfers in this view.
        </div>
      ) : null}

      {!isLoading && activeTransfers.length > 0 ? (
        <div className="overflow-hidden border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Source</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Destination</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Dispatched</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Received</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeTransfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{transfer.source_site_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{transfer.destination_site_name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_BADGE_STYLES[transfer.transfer_status]}`}>
                        {transfer.transfer_status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {transfer.dispatched_at ? new Date(transfer.dispatched_at).toLocaleString() : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {transfer.received_at ? new Date(transfer.received_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {canManageTransfers && transfer.destination_site_id === effectiveSiteId
                          && RECEIVABLE_STATUSES.includes(transfer.transfer_status) ? (
                          <button
                            type="button"
                            onClick={() => openReceiveModal(transfer)}
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            Receive
                          </button>
                          ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {isDispatchModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeDispatchModal() }}
        >
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="dispatch-modal-title">
            <div className="flex items-start justify-between">
              <div>
                <h3 id="dispatch-modal-title" className="text-lg font-semibold text-slate-900">Dispatch Transfer</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Deducts stock from {sites.find((site) => site.id === effectiveSiteId)?.name ?? 'the selected site'} immediately.
                </p>
              </div>
              <button type="button" onClick={closeDispatchModal} aria-label="Close dispatch modal" className="text-2xl text-slate-500">×</button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); if (canManageTransfers && dispatchFormValid) submitDispatch() }}>
              <label className="block space-y-1 text-sm font-medium text-slate-700">
                <span>Destination site</span>
                <select
                  disabled={!canManageTransfers}
                  value={destinationSiteId}
                  onChange={(event) => setDestinationSiteId(event.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 disabled:bg-slate-100"
                >
                  <option value="">Select a site</option>
                  {sites.filter((site) => site.id !== effectiveSiteId).map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </label>

              <div className="space-y-3">
                <span className="text-sm font-medium text-slate-700">Line items</span>
                {dispatchLines.map((line) => (
                  <div key={line.id} className="grid grid-cols-[1fr_8rem_2rem] gap-2">
                    <select
                      disabled={!canManageTransfers}
                      value={line.materialId}
                      onChange={(event) => updateDispatchLine(line.id, { materialId: event.target.value })}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                    >
                      <option value="">Select material</option>
                      {materials.map((material) => (
                        <option key={material.id} value={material.id}>{material.material_code}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      disabled={!canManageTransfers}
                      value={line.quantity}
                      onChange={(event) => updateDispatchLine(line.id, { quantity: event.target.value })}
                      placeholder="Qty"
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => removeDispatchLine(line.id)}
                      disabled={!canManageTransfers || dispatchLines.length <= 1}
                      aria-label="Remove line"
                      className="text-slate-400 hover:text-rose-600 disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" disabled={!canManageTransfers} onClick={addDispatchLine} className="text-sm font-semibold text-slate-700 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40">
                  + Add line
                </button>
              </div>

              {dispatchFeedback?.kind === 'error' ? (
                <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{dispatchFeedback.message}</p>
              ) : null}
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={closeDispatchModal} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canManageTransfers || !dispatchFormValid || createMutation.isPending}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Dispatching...' : 'Dispatch Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {receivingTransfer ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeReceiveModal() }}
        >
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="receive-modal-title">
            <div className="flex items-start justify-between">
              <div>
                <h3 id="receive-modal-title" className="text-lg font-semibold text-slate-900">Receive Shipment</h3>
                <p className="mt-1 text-sm text-slate-600">
                  From {receivingTransfer.source_site_name} to {receivingTransfer.destination_site_name}. Log actual quantities and note any discrepancies.
                </p>
              </div>
              <button type="button" onClick={closeReceiveModal} aria-label="Close receiving modal" className="text-2xl text-slate-500">×</button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); if (canManageTransfers && receiveFormValid) submitReceive() }}>
              {receiveLines.map((line) => (
                <div key={line.materialId} className="space-y-2 border border-slate-200 p-3">
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                    <span>{line.materialCode}</span>
                    <span className="font-normal text-slate-500">Remaining: {line.remaining}</span>
                  </div>
                  <label className="block space-y-1 text-sm font-medium text-slate-700">
                    <span>Quantity received</span>
                    <input
                      type="number"
                      min="0"
                      max={line.remaining}
                      step="any"
                      disabled={!canManageTransfers}
                      value={line.quantity}
                      onChange={(event) => updateReceiveLine(line.materialId, { quantity: event.target.value })}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                  </label>
                  <label className="block space-y-1 text-sm font-medium text-slate-700">
                    <span>Discrepancy reason (if any)</span>
                    <input
                      type="text"
                      disabled={!canManageTransfers}
                      value={line.discrepancyReason}
                      onChange={(event) => updateReceiveLine(line.materialId, { discrepancyReason: event.target.value })}
                      placeholder="e.g. damaged in transit"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                    />
                  </label>
                </div>
              ))}
              {receiveFeedback?.kind === 'error' ? (
                <p className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{receiveFeedback.message}</p>
              ) : null}
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={closeReceiveModal} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canManageTransfers || !receiveFormValid || receiveMutation.isPending}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {receiveMutation.isPending ? 'Reconciling...' : 'Reconcile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default SiteTransfersPage
