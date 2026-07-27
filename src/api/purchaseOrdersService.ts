import axios from 'axios'
import axiosClient from './axiosClient'
import type { POItem, POStatus, PurchaseOrder } from '../types/schema'

export interface ManagedPurchaseOrder extends PurchaseOrder {
  vendor_name: string
  target_site_name: string
  line_count: number
  ordered_quantity_base_uom: number
  received_quantity_base_uom: number
  open_quantity_base_uom: number
  created_at: string
  updated_at: string
  items?: Array<POItem & {
    id: string
    material_code: string
    received_quantity_base_uom: number
    open_quantity_base_uom: number
    created_at: string
    updated_at: string
  }>
}

export interface PurchaseOrderInput {
  poNumber: string
  vendorId: string
  targetSiteId: string
  expectedDeliveryDate: string | null
  items: Array<{
    materialId: string
    orderedQuantityBaseUom: number
    unitRate: number
  }>
}

interface PurchaseOrderListResponse {
  data: ManagedPurchaseOrder[]
  pagination: { page: number; page_size: number; total: number }
}

interface PurchaseOrderResponse {
  data: ManagedPurchaseOrder
}

interface PurchaseOrderErrorBody {
  message?: string
}

export async function fetchPurchaseOrders(tenantId: string) {
  const response = await axiosClient.get<PurchaseOrderListResponse>('/purchase-orders', {
    params: { tenant_id: tenantId, status: 'all', page_size: 200 },
  })
  return response.data
}

export async function createPurchaseOrder(tenantId: string, input: PurchaseOrderInput) {
  const response = await axiosClient.post<PurchaseOrderResponse>('/purchase-orders', {
    tenant_id: tenantId,
    po_number: input.poNumber,
    vendor_id: input.vendorId,
    target_site_id: input.targetSiteId,
    expected_delivery_date: input.expectedDeliveryDate,
    status: 'DRAFT',
    items: input.items.map((item) => ({
      material_id: item.materialId,
      ordered_quantity_base_uom: item.orderedQuantityBaseUom,
      unit_rate: item.unitRate,
    })),
  })
  return response.data.data
}

export async function updatePurchaseOrderStatus(
  tenantId: string,
  purchaseOrderId: string,
  status: POStatus,
) {
  const response = await axiosClient.patch<PurchaseOrderResponse>(
    `/purchase-orders/${purchaseOrderId}/status`,
    { tenant_id: tenantId, status },
  )
  return response.data.data
}

export function formatPurchaseOrderError(error: unknown) {
  if (!axios.isAxiosError<PurchaseOrderErrorBody>(error)) {
    return 'The purchase order could not be saved.'
  }
  return error.response?.data?.message ?? 'The purchase order could not be saved.'
}