import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { formatApiError } from '../api/errorUtils'
import { entitiesQueryKey, inventoryBalancesQueryKey, masterDataQueryKey, purchaseOrdersQueryKey } from '../api/queryKeys'
import { fetchInventoryBalances } from '../api/inventoryService'
import { fetchEntities } from '../api/entitiesService'
import { useEquipment } from '../api/equipmentQueries'
import {
  createFluidDispense,
  syncTransactionsCsv,
  syncTransactionsBatch,
} from '../api/transactionsService'
import { fetchMasterData } from '../api/masterDataService'
import {
  createPurchaseOrder,
  fetchPurchaseOrder,
  fetchPurchaseOrders,
  formatPurchaseOrderError,
  updatePurchaseOrderStatus,
  updatePurchaseOrder,
} from '../api/purchaseOrdersService'
import { useBulkApprovePOs } from '../api/purchaseOrderQueries'
import POProgressTracker from '../components/POProgressTracker'
import { POStatusBadge } from '../components/POStatusBadge'
import type {
  BatchSyncResponse,
  FluidDispenseResponse,
} from '../api/syncContracts'
import { useAuthContext } from '../context/useAuthContext'
import { useSyncRetryContext } from '../context/useSyncRetryContext'
import { useTenantContext } from '../context/useTenantContext'
import { hasRequiredRole } from '../types/rbac'
import type {
  InventoryTransaction,
  POApprovalStatus,
  POItem,
  POStatus,
  TransactionType,
} from '../types/schema'

interface ProcurementLineDraft extends POItem {
  id: string
}

type SubmissionContext = 'standard' | 'retry' | 'correction'

interface OperationNotice {
  tone: 'info' | 'success' | 'warning'
  message: string
}

interface LedgerForm {
  site_id: string
  material_id: string
  po_id: string
  transaction_type: TransactionType
  quantity: string
  source_entity_id: string
  destination_entity_id: string
  transaction_date: string
  includeCommercial: boolean
  includeVolumetric: boolean
  invoice_no: string
  base_rate: string
  gst_tier: string
  transport_charges: string
  length: string
  breadth: string
  height: string
  loaded_weight: string
  empty_weight: string
  correction_of_transaction_id: string
  correction_reason: string
}

const PROCUREMENT_DRAFT_VERSION = 1

function procurementDraftKey(tenantId: string) {
  return `concove:procurement-draft:v${PROCUREMENT_DRAFT_VERSION}:${tenantId}`
}

function loadProcurementRecovery(tenantId: string) {
  try {
    const raw = localStorage.getItem(procurementDraftKey(tenantId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      version: number
      editingPurchaseOrderId: string
      draft: { po_number: string; vendor_id: string; target_site_id: string; status: POStatus; expected_delivery_date: string; client_request_id: string }
      lineItems: ProcurementLineDraft[]
    }
    return parsed.version === PROCUREMENT_DRAFT_VERSION && parsed.lineItems.length > 0 ? parsed : null
  } catch {
    return null
  }
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

function getRequestedTransactionType(value: string | null): TransactionType {
  if (
    value === 'INWARD' ||
    value === 'OUTWARD' ||
    value === 'IST_DISPATCH' ||
    value === 'IST_RECEIPT'
  ) {
    return value
  }

  return 'INWARD'
}

function createEmptyLedgerForm(searchParams: URLSearchParams): LedgerForm {
  return {
    site_id: searchParams.get('site') ?? '',
    material_id: searchParams.get('material') ?? '',
    po_id: '',
    transaction_type: getRequestedTransactionType(searchParams.get('type')),
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
  }
}

function createLedgerFormFromTransaction(
  transaction: InventoryTransaction,
  context: Exclude<SubmissionContext, 'standard'>,
): LedgerForm {
  const transactionType = context === 'correction'
    ? getCompensatingTransactionType(transaction.transaction_type)
    : transaction.transaction_type

  return {
    site_id: transaction.site_id,
    material_id: transaction.material_id,
    po_id: transactionType === 'INWARD' ? transaction.po_id ?? '' : '',
    transaction_type: transactionType,
    quantity: String(transaction.quantity),
    source_entity_id: context === 'correction'
      ? transaction.destination_entity_id ?? ''
      : transaction.source_entity_id ?? '',
    destination_entity_id: context === 'correction'
      ? transaction.source_entity_id ?? ''
      : transaction.destination_entity_id ?? '',
    transaction_date: context === 'correction'
      ? new Date().toISOString()
      : transaction.transaction_date,
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
    correction_of_transaction_id: context === 'correction'
      ? transaction.client_transaction_id
      : transaction.correction_of_transaction_id ?? '',
    correction_reason: context === 'correction' ? '' : transaction.correction_reason ?? '',
  }
}

function OperationsPage() {
  const { user } = useAuthContext()
  const { selectedTenantId, selectedTenantName } = useTenantContext()
  const queryClient = useQueryClient()
  const {
    getFailedRecord,
    getSyncHistoryRecord,
    removeFailedRecord,
    upsertFailedRecords,
    upsertSyncHistory,
  } = useSyncRetryContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialLedgerRequest] = useState(() => {
    const correctionId = searchParams.get('correction')
    if (correctionId) {
      return {
        context: 'correction' as const,
        sourceId: correctionId,
        transaction: getSyncHistoryRecord(correctionId)?.transaction,
      }
    }

    const retryId = searchParams.get('retry')
    if (retryId) {
      return {
        context: 'retry' as const,
        sourceId: retryId,
        transaction: getFailedRecord(retryId)?.transaction,
      }
    }

    return null
  })
  const { data } = useQuery({
    queryKey: masterDataQueryKey(selectedTenantId),
    queryFn: () => fetchMasterData({ tenantId: selectedTenantId }),
  })
  const { data: purchaseOrderData, isLoading: purchaseOrdersLoading } = useQuery({
    queryKey: purchaseOrdersQueryKey(selectedTenantId),
    queryFn: () => fetchPurchaseOrders(selectedTenantId),
  })

  const materials = data?.data.materials ?? []
  const entities = useMemo(() => data?.data.entities ?? [], [data])
  const purchaseOrders = purchaseOrderData?.data ?? []
  const sites = useMemo(
    () => entities.filter((entity) => entity.entity_type === 'INTERNAL_SITE'),
    [entities],
  )
  const vendors = useMemo(
    () => entities.filter((entity) => entity.entity_type === 'VENDOR'),
    [entities],
  )

  const [activeSection, setActiveSection] = useState<'procurement' | 'ledger' | 'sync'>(() =>
    searchParams.get('mode') === 'ledger' || initialLedgerRequest
      ? 'ledger'
      : 'procurement',
  )

  const [procurementRecovery] = useState(() => loadProcurementRecovery(selectedTenantId))
  const [editingPurchaseOrderId, setEditingPurchaseOrderId] = useState(procurementRecovery?.editingPurchaseOrderId ?? '')

  const [procurementDraft, setProcurementDraft] = useState(procurementRecovery?.draft ?? {
    client_request_id: crypto.randomUUID(),
    po_number: '',
    vendor_id: '',
    target_site_id: '',
    status: 'DRAFT' as POStatus,
    expected_delivery_date: '',
  })
  const [lineItems, setLineItems] = useState<ProcurementLineDraft[]>(procurementRecovery?.lineItems ?? [
    {
      id: crypto.randomUUID(),
      material_id: '',
      ordered_quantity_base_uom: 1,
      unit_rate: 0,
    },
  ])
  const [statusDrafts, setStatusDrafts] = useState<Record<string, POStatus>>({})
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([])
  const [procurementFeedback, setProcurementFeedback] = useState<{
    kind: 'success' | 'error'
    message: string
  } | null>(null)

  useEffect(() => {
    const hasDraftContent = Boolean(
      procurementDraft.po_number || procurementDraft.vendor_id || procurementDraft.target_site_id ||
      lineItems.some((item) => item.material_id),
    )
    if (!hasDraftContent) {
      localStorage.removeItem(procurementDraftKey(selectedTenantId))
      return
    }
    localStorage.setItem(procurementDraftKey(selectedTenantId), JSON.stringify({
      version: PROCUREMENT_DRAFT_VERSION,
      editingPurchaseOrderId,
      draft: procurementDraft,
      lineItems,
      savedAt: new Date().toISOString(),
    }))
  }, [editingPurchaseOrderId, lineItems, procurementDraft, selectedTenantId])

  const [ledgerForm, setLedgerForm] = useState<LedgerForm>(() =>
    initialLedgerRequest?.transaction
      ? createLedgerFormFromTransaction(initialLedgerRequest.transaction, initialLedgerRequest.context)
      : createEmptyLedgerForm(searchParams),
  )
  const balanceQuery = useQuery({
    queryKey: inventoryBalancesQueryKey(selectedTenantId, ledgerForm.site_id, ledgerForm.material_id),
    queryFn: () => fetchInventoryBalances({
      tenantId: selectedTenantId,
      siteId: ledgerForm.site_id,
      materialId: ledgerForm.material_id,
    }),
    enabled: Boolean(ledgerForm.site_id && ledgerForm.material_id),
  })
  const operationalEntitiesQuery = useQuery({
    queryKey: entitiesQueryKey(selectedTenantId, { status: 'active', siteId: ledgerForm.site_id }),
    queryFn: () => fetchEntities({
      tenantId: selectedTenantId,
      status: 'active',
      siteId: ledgerForm.site_id,
      pageSize: 200,
    }),
    enabled: Boolean(ledgerForm.site_id),
  })
  const operationalEntities = operationalEntitiesQuery.data?.data ?? entities
  const operationalVendors = operationalEntities.filter((entity) => entity.entity_type === 'VENDOR')
  const operationalNonSiteEntities = operationalEntities.filter((entity) => entity.entity_type !== 'INTERNAL_SITE')
  const fluidEquipmentQuery = useEquipment({
    tenantId: selectedTenantId,
    siteId: ledgerForm.site_id,
    status: 'ACTIVE',
  })
  const fluidEquipmentOptions = fluidEquipmentQuery.data?.data ?? []
  const selectedBalance = balanceQuery.data?.data[0]
  const outboundQuantityExceedsBalance = (
    ledgerForm.transaction_type === 'OUTWARD' || ledgerForm.transaction_type === 'IST_DISPATCH'
  ) && Number(ledgerForm.quantity) > Number(selectedBalance?.quantity_base_uom ?? 0)
  const [batchResult, setBatchResult] = useState<BatchSyncResponse | null>(null)
  const [fluidResult, setFluidResult] = useState<FluidDispenseResponse | null>(null)
  const [batchError, setBatchError] = useState('')
  const [fluidError, setFluidError] = useState('')
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null)
  const [ledgerError, setLedgerError] = useState(() => {
    if (!initialLedgerRequest || initialLedgerRequest.transaction) {
      return ''
    }

    return initialLedgerRequest.context === 'correction'
      ? 'Correction source record was not found in sync history.'
      : 'Retry record was not found in Sync Monitor history.'
  })
  const [operationNotice, setOperationNotice] = useState<OperationNotice | null>(() =>
    initialLedgerRequest?.transaction
      ? {
          tone: 'info',
          message: initialLedgerRequest.context === 'correction'
            ? `Loaded correction draft for ${initialLedgerRequest.sourceId}. Submit a compensating entry after reviewing the payload.`
            : `Loaded retry payload for ${initialLedgerRequest.sourceId}. Review the data and resubmit when ready.`,
        }
      : searchParams.get('mode') === 'ledger' &&
        (searchParams.has('site') || searchParams.has('material'))
      ? {
          tone: 'info',
          message: 'Loaded site and material context from the inventory dashboard. Review the entry before submitting.',
        }
      : null,
  )
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false)
  const [isSubmittingFluid, setIsSubmittingFluid] = useState(false)
  const [fluidVehicleEquipmentId, setFluidVehicleEquipmentId] = useState('')
  const [submissionContext, setSubmissionContext] = useState<SubmissionContext>(
    initialLedgerRequest?.transaction ? initialLedgerRequest.context : 'standard',
  )
  const [currentTransactionId, setCurrentTransactionId] = useState<string>(
    initialLedgerRequest?.context === 'retry' && initialLedgerRequest.transaction
      ? initialLedgerRequest.transaction.client_transaction_id
      : crypto.randomUUID(),
  )

  useEffect(() => {
    if (!searchParams.has('retry') && !searchParams.has('correction')) {
      return
    }

    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('retry')
    nextParams.delete('correction')
    setSearchParams(nextParams, { replace: true })
  }, [searchParams, setSearchParams])

  const activeOrders = purchaseOrders.filter((order) => order.status !== 'COMPLETED')
  const receivableOrders = purchaseOrders.filter((order) =>
    (order.status === 'APPROVED' || order.status === 'PARTIALLY_FULFILLED') &&
    (!ledgerForm.site_id || order.target_site_id === ledgerForm.site_id),
  )
  const selectablePoIds = activeOrders
    .filter((order) => (order.po_status ?? 'DRAFT') === 'PENDING_APPROVAL')
    .map((order) => order.id)
  const canManageProcurementDrafts = Boolean(user && hasRequiredRole(user.role, ['ADMIN', 'SITE_MANAGER', 'OPERATOR']))
  const canManageProcurementApprovals = Boolean(user && hasRequiredRole(user.role, ['ADMIN', 'SITE_MANAGER']))
  const canRunLedgerMutations = Boolean(user && hasRequiredRole(user.role, ['ADMIN', 'SITE_MANAGER', 'OPERATOR']))

  const procurementPreview = lineItems.map((item) => ({
    ...item,
    material: materials.find((material) => material.id === item.material_id)?.material_code ?? 'Unselected',
  }))

  const sourceOptions = useMemo(() => {
    if (ledgerForm.transaction_type === 'INWARD') {
      return operationalVendors
    }

    if (ledgerForm.transaction_type === 'OUTWARD') {
      return operationalNonSiteEntities.filter(
        (entity) => entity.entity_type === 'SUBCONTRACTOR' || entity.entity_type === 'EMPLOYEE',
      )
    }

    return operationalNonSiteEntities
  }, [ledgerForm.transaction_type, operationalNonSiteEntities, operationalVendors])

  const loadCorrectionDraft = (clientTransactionId: string) => {
    const historyRecord = getSyncHistoryRecord(clientTransactionId)
    setActiveSection('ledger')

    if (!historyRecord) {
      setLedgerError('Correction source record was not found in sync history.')
      return
    }

    setCurrentTransactionId(crypto.randomUUID())
    setSubmissionContext('correction')
    setLedgerForm(createLedgerFormFromTransaction(historyRecord.transaction, 'correction'))
    setOperationNotice({
      tone: 'info',
      message: `Loaded correction draft for ${clientTransactionId}. Submit a compensating entry after reviewing the payload.`,
    })
    setLedgerError('')
  }

  const loadRetryDraft = (clientTransactionId: string) => {
    const retryRecord = getFailedRecord(clientTransactionId)
    setActiveSection('ledger')

    if (!retryRecord) {
      setLedgerError('Retry record was not found in Sync Monitor history.')
      return
    }

    setCurrentTransactionId(retryRecord.transaction.client_transaction_id)
    setSubmissionContext('retry')
    setLedgerForm(createLedgerFormFromTransaction(retryRecord.transaction, 'retry'))
    setOperationNotice({
      tone: 'info',
      message: `Loaded retry payload for ${clientTransactionId}. Review the data and resubmit when ready.`,
    })
    setLedgerError('')
  }

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

  const invalidatePurchaseOrders = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: purchaseOrdersQueryKey(selectedTenantId) }),
      queryClient.invalidateQueries({ queryKey: ['master-data', selectedTenantId] }),
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard', selectedTenantId] }),
      queryClient.invalidateQueries({ queryKey: ['site-materials', selectedTenantId] }),
    ])
  }

  const savePurchaseOrderMutation = useMutation({
    mutationFn: () => {
      const input = {
      clientRequestId: procurementDraft.client_request_id,
      poNumber: procurementDraft.po_number,
      vendorId: procurementDraft.vendor_id,
      targetSiteId: procurementDraft.target_site_id,
      expectedDeliveryDate: procurementDraft.expected_delivery_date || null,
      items: lineItems.map((item) => ({
        materialId: item.material_id,
        orderedQuantityBaseUom: Number(item.ordered_quantity_base_uom),
        unitRate: Number(item.unit_rate),
      })),
      }
      return editingPurchaseOrderId
        ? updatePurchaseOrder(selectedTenantId, editingPurchaseOrderId, input)
        : createPurchaseOrder(selectedTenantId, input)
    },
    onSuccess: async (purchaseOrder) => {
      await invalidatePurchaseOrders()
      setProcurementFeedback({
        kind: 'success',
        message: `${purchaseOrder.po_number} was ${editingPurchaseOrderId ? 'updated' : 'saved'} as a draft.`,
      })
      localStorage.removeItem(procurementDraftKey(selectedTenantId))
      setEditingPurchaseOrderId('')
      setProcurementDraft({
        client_request_id: crypto.randomUUID(),
        po_number: '',
        vendor_id: '',
        target_site_id: '',
        status: 'DRAFT',
        expected_delivery_date: '',
      })
      setLineItems([{
        id: crypto.randomUUID(),
        material_id: '',
        ordered_quantity_base_uom: 1,
        unit_rate: 0,
      }])
    },
    onError: (error) => {
      setProcurementFeedback({ kind: 'error', message: formatPurchaseOrderError(error) })
    },
  })

  const loadPurchaseOrderMutation = useMutation({
    mutationFn: (purchaseOrderId: string) => fetchPurchaseOrder(selectedTenantId, purchaseOrderId),
    onSuccess: (purchaseOrder) => {
      setEditingPurchaseOrderId(purchaseOrder.id)
      setProcurementDraft({
        client_request_id: crypto.randomUUID(),
        po_number: purchaseOrder.po_number,
        vendor_id: purchaseOrder.vendor_id,
        target_site_id: purchaseOrder.target_site_id,
        status: 'DRAFT',
        expected_delivery_date: purchaseOrder.expected_delivery_date?.slice(0, 10) ?? '',
      })
      setLineItems((purchaseOrder.items ?? []).map((item) => ({
        id: item.id,
        material_id: item.material_id,
        ordered_quantity_base_uom: Number(item.ordered_quantity_base_uom),
        unit_rate: Number(item.unit_rate),
      })))
      setActiveSection('procurement')
      setProcurementFeedback({ kind: 'success', message: `Editing ${purchaseOrder.po_number}.` })
    },
    onError: (error) => setProcurementFeedback({ kind: 'error', message: formatPurchaseOrderError(error) }),
  })

  const updatePurchaseOrderStatusMutation = useMutation({
    mutationFn: ({ purchaseOrderId, status }: { purchaseOrderId: string; status: POStatus }) =>
      updatePurchaseOrderStatus(selectedTenantId, purchaseOrderId, status),
    onSuccess: async (purchaseOrder) => {
      await invalidatePurchaseOrders()
      setStatusDrafts((current) => {
        const next = { ...current }
        delete next[purchaseOrder.id]
        return next
      })
      setProcurementFeedback({
        kind: 'success',
        message: `${purchaseOrder.po_number} moved to ${purchaseOrder.status}.`,
      })
    },
    onError: (error) => {
      setProcurementFeedback({ kind: 'error', message: formatPurchaseOrderError(error) })
    },
  })

  const bulkApproveMutation = useBulkApprovePOs(selectedTenantId)

  const handleApproveSelectedPos = async () => {
    if (!canManageProcurementApprovals) {
      setProcurementFeedback({ kind: 'error', message: 'Your role cannot approve purchase orders.' })
      return
    }
    const purchaseOrderIds = selectedPoIds
    if (purchaseOrderIds.length === 0) return
    try {
      const response = await bulkApproveMutation.mutateAsync(purchaseOrderIds)
      const successCount = response.results.filter((row) => row.sync_status === 'SYNCED').length
      const failureCount = response.results.length - successCount
      setSelectedPoIds((current) =>
        current.filter((id) =>
          response.results.some((row) => row.purchase_order_id === id && row.sync_status === 'FAILED'),
        ),
      )
      setProcurementFeedback({
        kind: failureCount > 0 ? 'error' : 'success',
        message: failureCount > 0
          ? `Approved ${successCount} of ${response.results.length} purchase orders. ${failureCount} failed — review statuses and retry.`
          : `Approved ${successCount} purchase order${successCount === 1 ? '' : 's'}.`,
      })
    } catch (error) {
      setProcurementFeedback({ kind: 'error', message: formatPurchaseOrderError(error) })
    }
  }

  const handleProcurementSave = () => {
    setProcurementFeedback(null)
    if (!canManageProcurementDrafts) {
      setProcurementFeedback({ kind: 'error', message: 'Your role has read-only access for purchase order drafts.' })
      return
    }
    if (!procurementDraft.po_number.trim() || !procurementDraft.vendor_id || !procurementDraft.target_site_id) {
      setProcurementFeedback({
        kind: 'error',
        message: 'PO number, vendor, and target site are required.',
      })
      return
    }
    if (lineItems.some((item) => !item.material_id || Number(item.ordered_quantity_base_uom) <= 0 || Number(item.unit_rate) < 0)) {
      setProcurementFeedback({
        kind: 'error',
        message: 'Every line needs a material, positive quantity, and non-negative unit rate.',
      })
      return
    }
    if (new Set(lineItems.map((item) => item.material_id)).size !== lineItems.length) {
      setProcurementFeedback({ kind: 'error', message: 'Each material may appear only once per purchase order.' })
      return
    }
    savePurchaseOrderMutation.mutate()
  }

  const handleBatchSync = async () => {
    setBatchError('')
    setBatchResult(null)
    setLedgerError('')
    setOperationNotice(null)

    if (!canRunLedgerMutations) {
      setLedgerError('Your role has read-only access for ledger submissions.')
      return
    }

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions', selectedTenantId] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-balances', selectedTenantId] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-dashboard', selectedTenantId] }),
      ])

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

    if (!canRunLedgerMutations) {
      setFluidError('Your role has read-only access for fluid dispense operations.')
      return
    }

    setIsSubmittingFluid(true)

    try {
      const response = await createFluidDispense({
        client_transaction_id: crypto.randomUUID(),
        site_id: ledgerForm.site_id || sites[0]?.id || '',
        vehicle_id: fluidVehicleEquipmentId || fluidEquipmentOptions[0]?.id || '',
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

  const handleCsvBatchSync = async () => {
    setBatchError('')
    setBatchResult(null)
    setLedgerError('')
    setOperationNotice(null)

    if (!canRunLedgerMutations) {
      setLedgerError('Your role has read-only access for ledger submissions.')
      return
    }

    if (!selectedCsvFile) {
      setLedgerError('Select a CSV file before submitting.')
      return
    }

    setIsSubmittingBatch(true)

    try {
      const csvContent = await selectedCsvFile.text()
      const response = await syncTransactionsCsv(csvContent)
      setBatchResult(response)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions', selectedTenantId] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-balances', selectedTenantId] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-dashboard', selectedTenantId] }),
      ])

      const successCount = response.results.filter((row) => row.sync_status === 'SUCCESS').length
      const failureCount = response.results.length - successCount

      if (failureCount > 0) {
        setOperationNotice({
          tone: 'warning',
          message: `CSV import finished with ${successCount} success and ${failureCount} failure. Review Sync Status for row-level details.`,
        })
      } else {
        setOperationNotice({
          tone: 'success',
          message: `CSV import completed successfully for ${selectedTenantName}.`,
        })
      }
    } catch (error) {
      setBatchError(
        formatApiError(
          error,
          'CSV upload failed before reaching multi-status processing.',
        ),
      )
    } finally {
      setIsSubmittingBatch(false)
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
            <h3 className="text-base font-semibold text-slate-900">Purchase Orders</h3>
            <p className="text-sm text-slate-600">
              Create tenant purchase orders and advance them through their fulfillment lifecycle.
            </p>
            {!canManageProcurementDrafts ? <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Your role has read-only access for procurement drafts.</p> : null}
            {editingPurchaseOrderId ? <p className="mt-2 text-xs font-semibold text-amber-700">Editing persisted DRAFT order. Saving replaces its header and lines atomically.</p> : null}
            {procurementRecovery ? <p className="mt-2 text-xs text-slate-500">Recovered an unsaved procurement draft from this browser.</p> : null}
            {procurementFeedback ? (
              <p className={`mt-2 rounded-md border px-3 py-2 text-sm ${
                procurementFeedback.kind === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}>
                {procurementFeedback.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>PO Number</span>
              <input
                disabled={!canManageProcurementDrafts}
                value={procurementDraft.po_number}
                onChange={(event) =>
                  setProcurementDraft((current) => ({ ...current, po_number: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-1 disabled:bg-slate-100"
                placeholder="PO-001"
              />
            </label>

            <div className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Status</span>
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900">
                DRAFT
              </p>
            </div>

            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Vendor</span>
              <select
                disabled={!canManageProcurementDrafts}
                value={procurementDraft.vendor_id}
                onChange={(event) =>
                  setProcurementDraft((current) => ({ ...current, vendor_id: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
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
                disabled={!canManageProcurementDrafts}
                value={procurementDraft.target_site_id}
                onChange={(event) =>
                  setProcurementDraft((current) => ({
                    ...current,
                    target_site_id: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
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
                disabled={!canManageProcurementDrafts}
                value={procurementDraft.expected_delivery_date}
                onChange={(event) =>
                  setProcurementDraft((current) => ({
                    ...current,
                    expected_delivery_date: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
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
                disabled={!canManageProcurementDrafts}
                onClick={handleAddLineItem}
                className="rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
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
                      disabled={!canManageProcurementDrafts}
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
                      className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
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
                      disabled={!canManageProcurementDrafts}
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
                      className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                    />
                  </label>

                  <label className="space-y-1 text-sm font-medium text-slate-700">
                    <span>Unit Rate</span>
                    <input
                      type="number"
                      step="0.000001"
                      disabled={!canManageProcurementDrafts}
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
                      className="w-full rounded-md border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        setLineItems((current) => current.filter((lineItem) => lineItem.id !== item.id))
                      }
                      disabled={!canManageProcurementDrafts || lineItems.length === 1}
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
              Materials must be actively assigned to the target site before this draft can be saved.
            </p>
            <button
              type="button"
              onClick={handleProcurementSave}
              disabled={!canManageProcurementDrafts || savePurchaseOrderMutation.isPending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savePurchaseOrderMutation.isPending ? 'Saving...' : editingPurchaseOrderId ? 'Update Draft' : 'Save Draft'}
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                Active Orders
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left">
                        <input
                          type="checkbox"
                          aria-label="Select all pending-approval purchase orders"
                          checked={selectablePoIds.length > 0 && selectablePoIds.every((id) => selectedPoIds.includes(id))}
                          disabled={!canManageProcurementApprovals || selectablePoIds.length === 0}
                          onChange={(event) => setSelectedPoIds(event.target.checked ? selectablePoIds : [])}
                        />
                      </th>
                      <th className="px-3 py-2 text-left">PO</th>
                      <th className="px-3 py-2 text-left">Vendor / Site</th>
                      <th className="px-3 py-2 text-left">Fulfillment</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">PO Status</th>
                      <th className="px-3 py-2 text-left">Status Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeOrders.map((order) => {
                      const poApprovalStatus: POApprovalStatus = order.po_status ?? 'DRAFT'
                      const isSelectable = poApprovalStatus === 'PENDING_APPROVAL'
                      return (
                      <tr key={order.id}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            aria-label={`Select ${order.po_number} for bulk approval`}
                            checked={selectedPoIds.includes(order.id)}
                            disabled={!canManageProcurementApprovals || !isSelectable}
                            onChange={(event) =>
                              setSelectedPoIds((current) =>
                                event.target.checked
                                  ? [...current, order.id]
                                  : current.filter((id) => id !== order.id),
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900">{order.po_number}</td>
                        <td className="px-3 py-2 text-slate-700">
                          <p>{order.vendor_name}</p>
                          <p className="text-xs text-slate-500">{order.target_site_name}</p>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          <div className="w-40">
                            <div className="mb-1 flex justify-between gap-2 text-xs">
                              <span>{Number(order.received_quantity_base_uom).toLocaleString()} received</span>
                              <span>{Number(order.open_quantity_base_uom).toLocaleString()} open</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full bg-emerald-600"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Number(order.ordered_quantity_base_uom) > 0
                                      ? (Number(order.received_quantity_base_uom) /
                                          Number(order.ordered_quantity_base_uom)) * 100
                                      : 0,
                                  )}%`,
                                }}
                              />
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              {Number(order.ordered_quantity_base_uom).toLocaleString()} ordered across {order.line_count} line{order.line_count === 1 ? '' : 's'}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{order.status}</td>
                        <td className="px-3 py-2">
                          <POStatusBadge status={poApprovalStatus} />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex min-w-64 gap-2">
                            {order.status === 'DRAFT' ? (
                              <button type="button" onClick={() => loadPurchaseOrderMutation.mutate(order.id)} disabled={!canManageProcurementDrafts || loadPurchaseOrderMutation.isPending} className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 disabled:opacity-40">Edit</button>
                            ) : null}
                            <select
                              disabled={!canManageProcurementApprovals}
                              value={statusDrafts[order.id] ?? order.status}
                              onChange={(event) =>
                                setStatusDrafts((current) => ({
                                  ...current,
                                  [order.id]: event.target.value as POStatus,
                                }))
                              }
                              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 disabled:bg-slate-100"
                            >
                              {(order.status === 'DRAFT'
                                ? ['DRAFT', 'APPROVED']
                                : order.status === 'APPROVED'
                                  ? ['APPROVED', 'PARTIALLY_FULFILLED', 'COMPLETED']
                                  : ['PARTIALLY_FULFILLED', 'COMPLETED']
                              ).map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={
                                !canManageProcurementApprovals ||
                                updatePurchaseOrderStatusMutation.isPending ||
                                (statusDrafts[order.id] ?? order.status) === order.status
                              }
                              onClick={() => updatePurchaseOrderStatusMutation.mutate({
                                purchaseOrderId: order.id,
                                status: statusDrafts[order.id] ?? order.status,
                              })}
                              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Update
                            </button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                    {activeOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-4 text-center text-slate-600">
                          {purchaseOrdersLoading
                            ? 'Loading purchase orders...'
                            : 'No active orders found for the selected tenant.'}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
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
            {!canRunLedgerMutations ? <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Your role has read-only access for ledger and fluid actions.</p> : null}
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
                    po_id: event.target.value === 'INWARD' ? current.po_id : '',
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

            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm md:col-span-2">
              {balanceQuery.isFetching ? (
                <p className="text-slate-500">Loading authoritative balance...</p>
              ) : selectedBalance ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p><span className="font-semibold text-slate-900">Available:</span> {selectedBalance.quantity_base_uom.toLocaleString()} {selectedBalance.base_uom_id}</p>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700">{selectedBalance.status}</span>
                  <p className="w-full text-xs text-slate-500">Critical at {Number(selectedBalance.critical_stock_threshold).toLocaleString()} · Low at {Number(selectedBalance.low_stock_threshold).toLocaleString()}</p>
                </div>
              ) : ledgerForm.site_id && ledgerForm.material_id ? (
                <p className="text-rose-700">This material is not actively assigned to the selected site.</p>
              ) : (
                <p className="text-slate-500">Select a site and material to load current stock.</p>
              )}
              {outboundQuantityExceedsBalance ? (
                <p className="mt-2 font-medium text-rose-700">Quantity exceeds available stock. The server will reject this entry.</p>
              ) : null}
            </div>

            <label className="space-y-0.5 text-sm font-medium text-slate-700">
              <span>Purchase Order</span>
              <select
                value={ledgerForm.po_id}
                disabled={ledgerForm.transaction_type !== 'INWARD'}
                onChange={(event) => {
                  const purchaseOrder = receivableOrders.find((order) => order.id === event.target.value)
                  setLedgerForm((current) => ({
                    ...current,
                    po_id: event.target.value,
                    site_id: purchaseOrder?.target_site_id ?? current.site_id,
                    source_entity_id: purchaseOrder?.vendor_id ?? current.source_entity_id,
                  }))
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="">No purchase order</option>
                {receivableOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.po_number} · {Number(order.open_quantity_base_uom).toLocaleString()} open
                  </option>
                ))}
              </select>
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
                {operationalNonSiteEntities.map((entity) => (
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

          <label className="block max-w-sm space-y-0.5 text-sm font-medium text-slate-700">
            <span>Vehicle / Equipment (Fluid Dispense)</span>
            <select
              value={fluidVehicleEquipmentId}
              onChange={(event) => setFluidVehicleEquipmentId(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">Select active equipment</option>
              {fluidEquipmentOptions.map((equipment) => (
                <option key={equipment.id} value={equipment.id}>
                  {equipment.name} · {equipment.registration_number}
                </option>
              ))}
            </select>
            {ledgerForm.site_id && !fluidEquipmentQuery.isLoading && fluidEquipmentOptions.length === 0 ? (
              <p className="text-xs text-slate-500">No active equipment assigned to this site.</p>
            ) : null}
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleBatchSync}
              disabled={!canRunLedgerMutations || isSubmittingBatch}
              className="rounded-md bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-amber-600 hover:shadow-md disabled:opacity-60"
            >
              {isSubmittingBatch ? 'Submitting...' : 'Commit to Ledger'}
            </button>
            <button
              type="button"
              onClick={handleFluidDispense}
              disabled={!canRunLedgerMutations || isSubmittingFluid}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {isSubmittingFluid ? 'Submitting fluid...' : 'Run Fluid Dispense'}
            </button>
            <p className="text-xs text-slate-500">
              client_transaction_id is generated immediately before the write request.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <h4 className="text-sm font-semibold text-slate-900">Bulk CSV Upload</h4>
            <p className="mt-1 text-xs text-slate-600">
              Upload a CSV with headers: client_transaction_id (optional), site_id, material_id, po_id, transaction_type, quantity, source_entity_id, destination_entity_id, transaction_date, correction_of_transaction_id, correction_reason, commercial_invoice_no, commercial_base_rate, commercial_gst_tier, commercial_transport_charges, volumetric_length, volumetric_breadth, volumetric_height, volumetric_loaded_weight, volumetric_empty_weight.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setSelectedCsvFile(event.target.files?.[0] ?? null)}
                className="block w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
              <button
                type="button"
                onClick={handleCsvBatchSync}
                disabled={!canRunLedgerMutations || isSubmittingBatch || !selectedCsvFile}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                {isSubmittingBatch ? 'Uploading CSV...' : 'Upload CSV to Ledger'}
              </button>
              {selectedCsvFile ? (
                <span className="text-xs text-slate-500">{selectedCsvFile.name}</span>
              ) : null}
            </div>
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
                                disabled={!canRunLedgerMutations}
                                onClick={() => loadCorrectionDraft(row.client_transaction_id)}
                                className="mt-2 rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
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
                                disabled={!canRunLedgerMutations}
                                onClick={() => loadRetryDraft(row.client_transaction_id)}
                                className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
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
      {canManageProcurementApprovals && selectedPoIds.length > 0 ? (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-lg">
            <span className="text-sm font-medium text-slate-700">
              {selectedPoIds.length} purchase order{selectedPoIds.length === 1 ? '' : 's'} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedPoIds([])}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleApproveSelectedPos}
              disabled={bulkApproveMutation.isPending}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkApproveMutation.isPending ? 'Approving...' : 'Approve Selected'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export default OperationsPage
