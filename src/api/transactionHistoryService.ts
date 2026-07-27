import axiosClient from './axiosClient'
import type { TransactionType } from '../types/schema'

export interface TransactionHistoryRow {
  id: string
  client_transaction_id: string
  site_id: string
  site_name: string
  material_id: string
  material_code: string
  material_description: string
  quantity_uom: string
  po_id: string | null
  po_number: string | null
  transaction_type: TransactionType
  quantity: number
  source_entity_id: string | null
  source_entity_name: string | null
  destination_entity_id: string | null
  destination_entity_name: string | null
  transaction_date: string
  correction_of_transaction_id: string | null
  correction_reason: string | null
  recorded_at: string
}

export interface TransactionHistoryDetail extends TransactionHistoryRow {
  commercial_details: {
    invoice_no: string | null
    base_rate: number | null
    gst_tier: number | null
    transport_charges: number | null
  } | null
  volumetric_details: {
    length: number | null
    breadth: number | null
    height: number | null
    loaded_weight: number | null
    empty_weight: number | null
  } | null
}

interface TransactionHistoryResponse {
  generated_at: string
  data: TransactionHistoryRow[]
  pagination: { page: number; page_size: number; total: number; has_next: boolean }
}

export async function fetchTransactionHistory(params: {
  tenantId: string
  search?: string
  transactionType?: TransactionType | 'ALL'
  page?: number
  pageSize?: number
  siteId?: string
  materialId?: string
}) {
  const response = await axiosClient.get<TransactionHistoryResponse>('/transactions', {
    params: {
      tenant_id: params.tenantId,
      search: params.search,
      transaction_type: params.transactionType === 'ALL' ? undefined : params.transactionType,
      page: params.page,
      page_size: params.pageSize,
      site_id: params.siteId,
      material_id: params.materialId,
    },
  })
  return response.data
}

export async function fetchTransactionDetail(tenantId: string, transactionId: string) {
  const response = await axiosClient.get<{ data: TransactionHistoryDetail }>(
    `/transactions/${transactionId}`,
    { params: { tenant_id: tenantId } },
  )
  return response.data.data
}