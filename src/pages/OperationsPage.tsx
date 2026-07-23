import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { formatApiError } from '../api/errorUtils'
import { masterDataQueryKey } from '../api/queryKeys'
import {
  createFluidDispense,
  syncTransactionsBatch,
} from '../api/transactionsService'
import { fetchMasterData } from '../api/masterDataService'
import POProgressTracker from '../components/POProgressTracker'
import type {
  BatchSyncResponse,
  FluidDispenseResponse,
} from '../api/syncContracts'
import { useSyncRetryContext } from '../context/SyncRetryContext'
import { useTenantContext } from '../context/TenantContext'
import type {
  InventoryTransaction,
  POItem,
  POStatus,
  PurchaseOrder,
  TransactionType,
} from '../types/schema'

interface PurchaseOrderDraft extends Omit<PurchaseOrder, 'id'> {
  id: string
}

interface ProcurementLineDraft extends POItem {
  id: string
}

type SubmissionContext = 'standard' | 'retry' | 'correction'

interface OperationNotice {
  tone: 'info' | 'success' | 'warning'
  message: string
}

function toNumber(value: string) {
  return Number(value || 0)
}

function isTenantMismatch(message: string) {
  return message.toLowerCase().includes('same tenant as site_id')
}

function getCompensatingTransactionType(transactionType: TransactionType): TransactionType {
  if (transactionType === 'INWARD') {
    return 'OUTWARD'
  }

  if (transactionType === 'OUTWARD') {
    return 'INWARD'
  }

  if (transactionType === 'IST_DISPATCH') {
    return 'IST_RECEIPT'
  }

  return 'IST_DISPATCH'
}

function OperationsPage() {
  const { selectedTenantId, selectedTenantName } = useTenantContext()
  const {
    getFailedRecord,
    getSyncHistoryRecord,
    removeFailedRecord,
    upsertFailedRecords,
    upsertSyncHistory,
  } = useSyncRetryContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: masterDataQueryKey(selectedTenantId),
    queryFn: () => fetchMasterData({ tenantId: selectedTenantId }),
  })

  const materials = data?.data.materials ?? []
  const entities = data?.data.entities ?? []
  const purchaseOrders = data?.data.purchase_orders ?? []
  const sites = useMemo(
    () => entities.filter((entity) => entity.entity_type === 'INTERNAL_SITE'),
    [entities],
  )
  const vendors = useMemo(
    () => entities.filter((entity) => entity.entity_type === 'VENDOR'),
    [entities],
  )
  const nonSiteEntities = useMemo(
    () => entities.filter((entity) => entity.entity_type !== 'INTERNAL_SITE'),
    [entities],
  )

  const [activeSection, setActiveSection] = useState<'procurement' | 'ledger' | 'sync'>('procurement')

  const [procurementDraft, setProcurementDraft] = useState({
    po_number: '',
    vendor_id: '',
    target_site_id: '',
    status: 'DRAFT' as POStatus,
    expected_delivery_date: '',
  })
  const [lineItems, setLineItems] = useState<ProcurementLineDraft[]>([
    {
      id: crypto.randomUUID(),
      material_id: '',
      ordered_quantity_base_uom: 1,
      unit_rate: 0,
    },
  ])
  const [stagedOrders, setStagedOrders] = useState<PurchaseOrderDraft[]>([])
  const [statusDrafts, setStatusDrafts] = useState<Record<string, POStatus>>({})

  const [ledgerForm, setLedgerForm] = useState({
    site_id: '',
    material_id: '',
    po_id: '',
    transaction_type: 'INWARD' as TransactionType,
    quantity: '',
    source_entity_id: '',
    destination_entity_id: '',
    transaction_date: new Date().toISOString(),
    includeCommercial: false,
    includeVolumetric: false,
    invoice_no: '',
    base_rate: '',
    gst_tier: '',
    transport_charges: '',
    length: '',
    breadth: '',
    height: '',
    loaded_weight: '',
    empty_weight: '',
    correction_of_transaction_id: '',
    correction_reason: '',
  })
  const [batchResult, setBatchResult] = useState<BatchSyncResponse | null>(null)
  const [fluidResult, setFluidResult] = useState<FluidDispenseResponse | null>(null)
  const [batchError, setBatchError] = useState('')
  const [fluidError, setFluidError] = useState('')
  const [ledgerError, setLedgerError] = useState('')
  const [operationNotice, setOperationNotice] = useState<OperationNotice | null>(null)
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false)
  const [isSubmittingFluid, setIsSubmittingFluid] = useState(false)
  const [submissionContext, setSubmissionContext] = useState<SubmissionContext>('standard')
  const [currentTransactionId, setCurrentTransactionId] = useState<string>(
    crypto.randomUUID(),
  )

  useEffect(() => {
    const retryId = searchParams.get('retry')
    const correctionId = searchParams.get('correction')

    if (correctionId) {
      const historyRecord = getSyncHistoryRecord(correctionId)

      setActiveSection('ledger')

      if (!historyRecord) {
        setLedgerError('Correction source record was not found in sync history.')

        const nextParams = new URLSearchParams(searchParams)
        nextParams.delete('correction')
        setSearchParams(nextParams, { replace: true })
        return
      }

      const transaction = historyRecord.transaction
      setCurrentTransactionId(crypto.randomUUID())
      setSubmissionContext('correction')
      setLedgerForm({
        site_id: transaction.site_id,
        material_id: transaction.material_id,
        po_id: transaction.po_id ?? '',
        transaction_type: getCompensatingTransactionType(transaction.transaction_type),
        quantity: String(transaction.quantity),
        source_entity_id: transaction.destination_entity_id ?? '',
        destination_entity_id: transaction.source_entity_id ?? '',
        transaction_date: new Date().toISOString(),
        includeCommercial: Boolean(transaction.commercial_details),
        includeVolumetric: Boolean(transaction.volumetric_details),
        invoice_no: transaction.commercial_details?.invoice_no ?? '',
        base_rate: String(transaction.commercial_details?.base_rate ?? ''),
        gst_tier: String(transaction.commercial_details?.gst_tier ?? ''),
        transport_charges: String(transaction.commercial_details?.transport_charges ?? ''),
        length: String(transaction.volumetric_details?.length ?? ''),
        breadth: String(transaction.volumetric_details?.breadth ?? ''),
        height: String(transaction.volumetric_details?.height ?? ''),
        loaded_weight: String(transaction.volumetric_details?.loaded_weight ?? ''),
        empty_weight: String(transaction.volumetric_details?.empty_weight ?? ''),
        correction_of_transaction_id: transaction.client_transaction_id,
        correction_reason: '',
      })
      setOperationNotice({
        tone: 'info',
        message: `Loaded correction draft for ${transaction.client_transaction_id}. Submit a compensating entry after reviewing the payload.`,
      })
      setLedgerError('')

      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('correction')
      setSearchParams(nextParams, { replace: true })
      return
    }

    if (!retryId) {
      return
    }

    const retryRecord = getFailedRecord(retryId)

    if (!retryRecord) {
      setLedgerError('Retry record was not found in Sync Monitor history.')
      setActiveSection('ledger')

      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('retry')
      setSearchParams(nextParams, { replace: true })
      return
    }

    const transaction = retryRecord.transaction
    setActiveSection('ledger')
    setSubmissionContext('retry')
    setCurrentTransactionId(transaction.client_transaction_id)
    setLedgerForm({
      site_id: transaction.site_id,
      material_id: transaction.material_id,
      po_id: transaction.po_id ?? '',
      transaction_type: transaction.transaction_type,
      quantity: String(transaction.quantity),
      source_entity_id: transaction.source_entity_id ?? '',
      destination_entity_id: transaction.destination_entity_id ?? '',
      transaction_date: transaction.transaction_date,
      includeCommercial: Boolean(transaction.commercial_details),
      includeVolumetric: Boolean(transaction.volumetric_details),
      invoice_no: transaction.commercial_details?.invoice_no ?? '',
      base_rate: String(transaction.commercial_details?.base_rate ?? ''),
      gst_tier: String(transaction.commercial_details?.gst_tier ?? ''),
      transport_charges: String(transaction.commercial_details?.transport_charges ?? ''),
      length: String(transaction.volumetric_details?.length ?? ''),
      breadth: String(transaction.volumetric_details?.breadth ?? ''),
      height: String(transaction.volumetric_details?.height ?? ''),
      loaded_weight: String(transaction.volumetric_details?.loaded_weight ?? ''),
      empty_weight: String(transaction.volumetric_details?.empty_weight ?? ''),
      correction_of_transaction_id: transaction.correction_of_transaction_id ?? '',
      correction_reason: transaction.correction_reason ?? '',
    })
    setOperationNotice({
      tone: 'info',
      message: `Loaded retry payload for ${retryRecord.client_transaction_id}. Review the data and resubmit when ready.`,
    })
    setLedgerError('')

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('retry')
    setSearchParams(nextParams, { replace: true })
  }, [getFailedRecord, getSyncHistoryRecord, searchParams, setSearchParams])

  const activeOrders = purchaseOrders.filter((order) => order.status !== 'COMPLETED')

  const procurementPreview = lineItems.map((item) => ({
    ...item,
    material: materials.find((material) => material.id === item.material_id)?.material_code ?? 'Unselected',
  }))

  const sourceOptions = useMemo(() => {
    if (ledgerForm.transaction_type === 'INWARD') {
      return vendors
    }

    if (ledgerForm.transaction_type === 'OUTWARD') {
      return nonSiteEntities.filter(
        (entity) => entity.entity_type === 'SUBCONTRACTOR' || entity.entity_type === 'EMPLOYEE',
      )
    }

    return nonSiteEntities
  }, [ledgerForm.transaction_type, nonSiteEntities, vendors])

  const handleAddLineItem = () => {
    setLineItems((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        material_id: '',
        ordered_quantity_base_uom: 1,
        unit_rate: 0,
      },
    ])
  }

  const handleProcurementSave = () => {
    const draft: PurchaseOrderDraft = {
      id: crypto.randomUUID(),
      po_number: procurementDraft.po_number,
      vendor_id: procurementDraft.vendor_id,
      target_site_id: procurementDraft.target_site_id,
      status: procurementDraft.status,
      expected_delivery_date: procurementDraft.expected_delivery_date,
      items: lineItems.map((item) => ({
        material_id: item.material_id,
        ordered_quantity_base_uom: Number(item.ordered_quantity_base_uom),
        unit_rate: Number(item.unit_rate),
      })),
    }

    setStagedOrders((current) => [draft, ...current])
    setProcurementDraft({
      po_number: '',
      vendor_id: '',
      target_site_id: '',
      status: 'DRAFT',
      expected_delivery_date: '',
    })
    setLineItems([
      {
        id: crypto.randomUUID(),
        material_id: '',
        ordered_quantity_base_uom: 1,
        unit_rate: 0,
      },
    ])
  }

  const handleBatchSync = async () => {
    setBatchError('')
    setBatchResult(null)
    setLedgerError('')
    setOperationNotice(null)
    setIsSubmittingBatch(true)

    if (!ledgerForm.site_id || !ledgerForm.material_id) {
      setLedgerError('site_id and material_id are required before submitting a ledger adjustment.')
      setIsSubmittingBatch(false)
      return
    }

    if (toNumber(ledgerForm.quantity) <= 0) {
      setLedgerError('quantity must be greater than 0.')
      setIsSubmittingBatch(false)
      return
    }

    if (
      ledgerForm.correction_of_transaction_id &&
      ledgerForm.correction_reason.trim().length === 0
    ) {
      setLedgerError('correction_reason is required for immutable correction entries.')
      setIsSubmittingBatch(false)
      return
    }

    const selectedSiteName =
      sites.find((site) => site.id === ledgerForm.site_id)?.name ?? 'selected site'

    const isConfirmed = window.confirm(
      `Are you sure you want to record this ${ledgerForm.transaction_type} entry for ${selectedSiteName}?`,
    )

    if (!isConfirmed) {
      setIsSubmittingBatch(false)
      return
    }

    const txId = crypto.randomUUID()

    try {
      const payload: { transactions: InventoryTransaction[] } = {
        transactions: [
          {
            client_transaction_id: txId,
            site_id: ledgerForm.site_id || sites[0]?.id || '',
            material_id: ledgerForm.material_id || materials[0]?.id || '',
            po_id: ledgerForm.po_id || null,
            transaction_type: ledgerForm.transaction_type,
            quantity: Math.max(0.01, toNumber(ledgerForm.quantity) || 1),
            source_entity_id: ledgerForm.source_entity_id || null,
            destination_entity_id: ledgerForm.destination_entity_id || null,
            transaction_date: ledgerForm.transaction_date,
            correction_of_transaction_id: ledgerForm.correction_of_transaction_id || undefined,
            correction_reason: ledgerForm.correction_reason.trim() || undefined,
            commercial_details: ledgerForm.includeCommercial
              ? {
                  invoice_no: ledgerForm.invoice_no || 'INV-DRAFT',
                  base_rate: toNumber(ledgerForm.base_rate),
                  gst_tier: toNumber(ledgerForm.gst_tier),
                  transport_charges: toNumber(ledgerForm.transport_charges),
                }
              : undefined,
            volumetric_details: ledgerForm.includeVolumetric
              ? {
                  length: toNumber(ledgerForm.length),
                  breadth: toNumber(ledgerForm.breadth),
                  height: toNumber(ledgerForm.height),
                  loaded_weight: toNumber(ledgerForm.loaded_weight),
                  empty_weight: toNumber(ledgerForm.empty_weight),
                }
              : undefined,
          },
        ],
      }

      const response = await syncTransactionsBatch(payload)
      setBatchResult(response)

      const successCount = response.results.filter((row) => row.sync_status === 'SUCCESS').length
      const failureCount = response.results.length - successCount

      upsertSyncHistory(
        response.results.map((row) => {
          const matchingTransaction = payload.transactions.find(
            (transaction) => transaction.client_transaction_id === row.client_transaction_id,
          )

          return {
            client_transaction_id: row.client_transaction_id,
            message: row.message,
            tenant_id: selectedTenantId,
            recorded_at: new Date().toISOString(),
            sync_status: row.sync_status,
            transaction: matchingTransaction ?? payload.transactions[0],
          }
        }),
      )

      const failedRecords = response.results
        .filter((row) => row.sync_status === 'FAILED')
        .map((row) => {
          const matchingTransaction = payload.transactions.find(
            (transaction) => transaction.client_transaction_id === row.client_transaction_id,
          )

          if (!matchingTransaction) {
            return null
          }

          return {
            client_transaction_id: row.client_transaction_id,
            message: row.message,
            tenant_id: selectedTenantId,
            failed_at: new Date().toISOString(),
            transaction: matchingTransaction,
          }
        })
        .filter((record): record is NonNullable<typeof record> => Boolean(record))

      upsertFailedRecords(failedRecords)

      response.results
        .filter((row) => row.sync_status === 'SUCCESS')
        .forEach((row) => {
          removeFailedRecord(row.client_transaction_id)
        })

      if (failureCount > 0) {
        setOperationNotice({
          tone: 'warning',
          message:
            submissionContext === 'correction'
              ? `Correction submission finished with ${successCount} success and ${failureCount} failure. Review Sync Status for row-level details.`
              : submissionContext === 'retry'
                ? `Retry submission finished with ${successCount} success and ${failureCount} failure. Review Sync Status for remaining issues.`
                : `Ledger submission finished with ${successCount} success and ${failureCount} failure. Review Sync Status for row-level details.`,
        })
      } else {
        setOperationNotice({
          tone: 'success',
          message:
            submissionContext === 'correction'
              ? `Correction entry submitted successfully for ${selectedTenantName}.`
              : submissionContext === 'retry'
                ? `Retry submission completed successfully for ${selectedTenantName}.`
                : `Ledger entry submitted successfully for ${selectedTenantName}.`,
        })
      }

      setCurrentTransactionId(crypto.randomUUID())
      setLedgerForm((current) => ({
        ...current,
        correction_of_transaction_id: '',
        correction_reason: '',
      }))
      setSubmissionContext('standard')
    } catch (error) {
      setBatchError(
        formatApiError(
          error,
          'Batch sync request failed before reaching multi-status processing.',
        ),
      )
    } finally {
      setIsSubmittingBatch(false)
    }
  }

  const handleFluidDispense = async () => {
    setFluidError('')
    setFluidResult(null)
    setIsSubmittingFluid(true)

    try {
      const response = await createFluidDispense({
        client_transaction_id: crypto.randomUUID(),
        site_id: ledgerForm.site_id || sites[0]?.id || '',
        vehicle_id: ledgerForm.destination_entity_id || nonSiteEntities[0]?.id || '',
        material_id: ledgerForm.material_id || materials[0]?.id || '',
        dispense_quantity: Math.max(0.01, toNumber(ledgerForm.quantity) || 1),
        logged_at: ledgerForm.transaction_date,
      })

      setFluidResult(response)
    } catch (error) {
      setFluidError(
        formatApiError(
          error,
          'Fluid dispense request failed before status reconciliation.',
        ),
      )
    } finally {
      setIsSubmittingFluid(false)
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-slate-900">Operations Control Workspace</h2>
        <p className="text-sm text-slate-600">
          Procurement drafting, immutable ledger adjustments, and multi-status reconciliation.
        </p>
        <p className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
          Active tenant: {selectedTenantName} ({selectedTenantId})
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(['procurement', 'ledger', 'sync'] as const).map((section) => (
          <button
            key={section}
            type="button"
            onClick={() => setActiveSection(section)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeSection === section
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {section === 'procurement'
              ? 'Procurement Superset'
              : section === 'ledger'
                ? 'Ledger Adjustment'
                : 'Sync Status'}
          </button>
        ))}
      </div>

      {activeSection === 'procurement' ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Procurement Superset View</h3>
            <p className="text-sm text-slate-600">
              Stage purchase_orders with dynamic po_items and status management.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>PO Number</span>
              <input
                value={procurementDraft.po_number}
                onChange={(event) =>
                  setProcurementDraft((current) => ({ ...current, po_number: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-1"
                placeholder="PO-001"
              />
            </label>

            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Status</span>
              <select
                value={procurementDraft.status}
                onChange={(event) =>
                  setProcurementDraft((current) => ({
                    ...current,
                    status: event.target.value as POStatus,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {(['DRAFT', 'APPROVED', 'PARTIALLY_FULFILLED', 'COMPLETED'] as POStatus[]).map(
                  (status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Vendor</span>
              <select
                value={procurementDraft.vendor_id}
                onChange={(event) =>
                  setProcurementDraft((current) => ({ ...current, vendor_id: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Select vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Target Site</span>
              <select
                value={procurementDraft.target_site_id}
                onChange={(event) =>
                  setProcurementDraft((current) => ({
                    ...current,
                    target_site_id: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Select site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-0.5 text-sm font-medium text-slate-700 md:col-span-2">
              <span>Expected Delivery Date</span>
              <input
                type="date"
                value={procurementDraft.expected_delivery_date}
                onChange={(event) =>
                  setProcurementDraft((current) => ({
                    ...current,
                    expected_delivery_date: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-700 mb-2">Purchase Order Stage</p>
            <POProgressTracker status={procurementDraft.status} compact={false} />
          </div>

          <div className="space-y-3 rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-sm font-semibold text-slate-900">PO Items</h4>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white"
              >
                Add Line Item
              </button>
            </div>

            <div className="space-y-3">
              {lineItems.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-md bg-slate-50 p-3 md:grid-cols-4">
                  <label className="space-y-0.5 text-sm font-medium text-slate-700 md:col-span-2">
                    <span>Material</span>
                    <select
                      value={item.material_id}
                      onChange={(event) =>
                        setLineItems((current) =>
                          current.map((lineItem) =>
                            lineItem.id === item.id
                              ? { ...lineItem, material_id: event.target.value }
                              : lineItem,
                          ),
                        )
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                    >
                      <option value="">Select material</option>
                      {materials.map((material) => (
                        <option key={material.id} value={material.id}>
                          {material.material_code}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    <span>Quantity</span>
                    <input
                      type="number"
                      step="0.000001"
                      value={item.ordered_quantity_base_uom}
                      onChange={(event) =>
                        setLineItems((current) =>
                          current.map((lineItem) =>
                            lineItem.id === item.id
                              ? {
                                  ...lineItem,
                                  ordered_quantity_base_uom: toNumber(event.target.value),
                                }
                              : lineItem,
                          ),
                        )
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    <span>Unit Rate</span>
                    <input
                      type="number"
                      step="0.000001"
                      value={item.unit_rate}
                      onChange={(event) =>
                        setLineItems((current) =>
                          current.map((lineItem) =>
                            lineItem.id === item.id
                              ? { ...lineItem, unit_rate: toNumber(event.target.value) }
                              : lineItem,
                          ),
                        )
                      }
                      className="w-full rounded-md border border-slate-300 px-3 py-2"
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        setLineItems((current) => current.filter((lineItem) => lineItem.id !== item.id))
                      }
                      disabled={lineItems.length === 1}
                      className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              The draft is staged locally until a procurement write endpoint is available.
            </p>
            <button
              type="button"
              onClick={handleProcurementSave}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Stage Purchase Order Draft
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                Active Orders
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left">PO</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Status Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-3 py-2 font-medium text-slate-900">{order.po_number}</td>
                        <td className="px-3 py-2 text-slate-700">{order.status}</td>
                        <td className="px-3 py-2">
                          <select
                            value={statusDrafts[order.id] ?? order.status}
                            onChange={(event) =>
                              setStatusDrafts((current) => ({
                                ...current,
                                [order.id]: event.target.value as POStatus,
                              }))
                            }
                            className="w-full rounded-md border border-slate-300 px-2 py-1"
                          >
                            {(['DRAFT', 'APPROVED', 'PARTIALLY_FULFILLED', 'COMPLETED'] as POStatus[]).map(
                              (status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ),
                            )}
                          </select>
                        </td>
                      </tr>
                    ))}
                    {activeOrders.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-slate-600">
                          No active orders found for the selected tenant.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                Draft Preview
              </div>
              <div className="space-y-3 p-3 text-sm text-slate-700">
                {stagedOrders.length === 0 ? (
                  <p>No staged drafts yet.</p>
                ) : (
                  stagedOrders.map((draft) => (
                    <div key={draft.id} className="rounded-md bg-slate-50 p-3">
                      <p className="font-semibold text-slate-900">{draft.po_number}</p>
                      <p>Status: {draft.status}</p>
                      <p>Vendor: {draft.vendor_id || '—'}</p>
                      <p>Site: {draft.target_site_id || '—'}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Items: {draft.items?.length ?? 0}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
              Line Item Payload Preview
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Material</th>
                    <th className="px-3 py-2 text-left">Quantity</th>
                    <th className="px-3 py-2 text-left">Unit Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {procurementPreview.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2 text-slate-900">{item.material}</td>
                      <td className="px-3 py-2 text-slate-700">{item.ordered_quantity_base_uom}</td>
                      <td className="px-3 py-2 text-slate-700">{item.unit_rate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {activeSection === 'ledger' ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Advanced Ledger Adjustment Form</h3>
            <p className="text-sm text-slate-600">
              Generates a fresh client_transaction_id on submit and appends nested commercial/volumetric details when enabled.
            </p>
            <p className="mt-2 font-mono text-xs text-slate-500">Trace ID: {currentTransactionId}</p>
            {ledgerForm.correction_of_transaction_id ? (
              <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Correction draft for immutable ledger record {ledgerForm.correction_of_transaction_id}.
              </p>
            ) : null}
            {operationNotice ? (
              <p
                className={`mt-2 rounded-md px-3 py-2 text-sm ${
                  operationNotice.tone === 'success'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    : operationNotice.tone === 'warning'
                      ? 'border border-amber-200 bg-amber-50 text-amber-800'
                      : 'border border-sky-200 bg-sky-50 text-sky-800'
                }`}
              >
                {operationNotice.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Site</span>
              <select
                value={ledgerForm.site_id}
                onChange={(event) => setLedgerForm((current) => ({ ...current, site_id: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-1"
              >
                <option value="">Select site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Material</span>
              <select
                value={ledgerForm.material_id}
                onChange={(event) =>
                  setLedgerForm((current) => ({ ...current, material_id: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Select material</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.material_code}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Transaction Type</span>
              <select
                value={ledgerForm.transaction_type}
                onChange={(event) =>
                  setLedgerForm((current) => ({
                    ...current,
                    transaction_type: event.target.value as TransactionType,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {(['INWARD', 'OUTWARD', 'IST_DISPATCH', 'IST_RECEIPT'] as TransactionType[]).map(
                  (transactionType) => (
                    <option key={transactionType} value={transactionType}>
                      {transactionType}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Quantity</span>
              <input
                type="number"
                step="0.000001"
                value={ledgerForm.quantity}
                onChange={(event) => setLedgerForm((current) => ({ ...current, quantity: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>PO ID</span>
              <input
                value={ledgerForm.po_id}
                onChange={(event) => setLedgerForm((current) => ({ ...current, po_id: event.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder="Optional"
              />
            </label>

            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Transaction Date</span>
              <input
                type="datetime-local"
                value={ledgerForm.transaction_date.slice(0, 16)}
                onChange={(event) =>
                  setLedgerForm((current) => ({
                    ...current,
                    transaction_date: new Date(event.target.value).toISOString(),
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Source Entity</span>
              <select
                value={ledgerForm.source_entity_id}
                onChange={(event) =>
                  setLedgerForm((current) => ({ ...current, source_entity_id: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Optional source entity</option>
                {sourceOptions.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Destination Entity / Vehicle</span>
              <select
                value={ledgerForm.destination_entity_id}
                onChange={(event) =>
                  setLedgerForm((current) => ({ ...current, destination_entity_id: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">Optional destination entity</option>
                {nonSiteEntities.map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-0.5 text-sm font-medium text-slate-700 md:col-span-2">
              <span>
                Correction Reason
                {ledgerForm.correction_of_transaction_id ? ' *' : ' (optional)'}
              </span>
              <textarea
                value={ledgerForm.correction_reason}
                onChange={(event) =>
                  setLedgerForm((current) => ({
                    ...current,
                    correction_reason: event.target.value,
                  }))
                }
                className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2"
                placeholder={
                  ledgerForm.correction_of_transaction_id
                    ? 'Explain why this compensating entry is required.'
                    : 'Optional operator note for this ledger entry.'
                }
              />
            </label>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() =>
                setLedgerForm((current) => ({
                  ...current,
                  includeCommercial: !current.includeCommercial,
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-sm font-medium text-slate-700"
            >
              Commercial Details {ledgerForm.includeCommercial ? '▾' : '▸'}
            </button>

            {ledgerForm.includeCommercial ? (
              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-0.5 text-sm font-medium text-slate-700">
                  <span>Invoice No</span>
                  <input
                    value={ledgerForm.invoice_no}
                    onChange={(event) =>
                      setLedgerForm((current) => ({ ...current, invoice_no: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-0.5 text-sm font-medium text-slate-700">
                  <span>Base Rate</span>
                  <input
                    type="number"
                    value={ledgerForm.base_rate}
                    onChange={(event) =>
                      setLedgerForm((current) => ({ ...current, base_rate: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-0.5 text-sm font-medium text-slate-700">
                  <span>GST Tier</span>
                  <input
                    type="number"
                    value={ledgerForm.gst_tier}
                    onChange={(event) =>
                      setLedgerForm((current) => ({ ...current, gst_tier: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="space-y-0.5 text-sm font-medium text-slate-700">
                  <span>Transport Charges</span>
                  <input
                    type="number"
                    value={ledgerForm.transport_charges}
                    onChange={(event) =>
                      setLedgerForm((current) => ({ ...current, transport_charges: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() =>
                setLedgerForm((current) => ({
                  ...current,
                  includeVolumetric: !current.includeVolumetric,
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-sm font-medium text-slate-700"
            >
              Volumetric Dimensions {ledgerForm.includeVolumetric ? '▾' : '▸'}
            </button>

            {ledgerForm.includeVolumetric ? (
              <div className="grid gap-3 md:grid-cols-5">
                {(['length', 'breadth', 'height', 'loaded_weight', 'empty_weight'] as const).map(
                  (field) => (
                    <label key={field} className="space-y-0.5 text-sm font-medium text-slate-700">
                      <span>{field.replace('_', ' ')}</span>
                      <input
                        type="number"
                        value={ledgerForm[field]}
                        onChange={(event) =>
                          setLedgerForm((current) => ({ ...current, [field]: event.target.value }))
                        }
                        className="w-full rounded-md border border-slate-300 px-3 py-2"
                      />
                    </label>
                  ),
                )}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBatchSync}
              disabled={isSubmittingBatch}
              className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-amber-600 hover:shadow-md disabled:opacity-60"
            >
              {isSubmittingBatch ? 'Submitting...' : 'Commit to Ledger'}
            </button>
            <button
              type="button"
              onClick={handleFluidDispense}
              disabled={isSubmittingFluid}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {isSubmittingFluid ? 'Submitting fluid...' : 'Run Fluid Dispense'}
            </button>
            <p className="text-xs text-slate-500">
              client_transaction_id is generated immediately before the write request.
            </p>
          </div>

          {ledgerError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {ledgerError}
            </p>
          ) : null}
        </div>
      ) : null}

      {activeSection === 'sync' ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Sync Result Inspector</h3>
            <p className="text-sm text-slate-600">
              Parse SUCCESS and FAILED records from HTTP 207 envelopes for operations feedback.
            </p>
          </div>

          {batchError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {batchError}
            </p>
          ) : null}

          {fluidError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {fluidError}
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Batch Results</h4>
              {batchResult ? (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-600">
                          Record
                        </th>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-600">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-600">
                          Message
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batchResult.results.map((row) => (
                        <tr key={row.client_transaction_id}>
                          <td className="px-3 py-2 font-mono text-xs text-slate-700">
                            {row.client_transaction_id}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                row.sync_status === 'SUCCESS'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {row.sync_status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            <p>{row.message}</p>
                            {row.sync_status === 'SUCCESS' ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/operations?correction=${row.client_transaction_id}`)}
                                className="mt-2 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
                              >
                                Correction
                              </button>
                            ) : null}
                            {isTenantMismatch(row.message) ? (
                              <p className="mt-1 text-xs text-amber-700">
                                Tenant mismatch: selected tenant is {selectedTenantName}. Affected record: {row.client_transaction_id}. Suggested correction: change tenant or entity mapping to match site tenant.
                              </p>
                            ) : null}
                            {row.sync_status === 'FAILED' ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/operations?retry=${row.client_transaction_id}`)}
                                className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700"
                              >
                                Fix & Retry
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No batch sync has run yet.</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <h4 className="text-sm font-semibold text-slate-900">Fluid Dispense Result</h4>
              {fluidResult ? (
                <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  <p>
                    <span className="font-semibold">Record:</span> {fluidResult.client_transaction_id}
                  </p>
                  <p>
                    <span className="font-semibold">Status:</span> {fluidResult.sync_status}
                  </p>
                  <p>
                    <span className="font-semibold">Message:</span> {fluidResult.message}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">No fluid dispense run yet.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default OperationsPage
