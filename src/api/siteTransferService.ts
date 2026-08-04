import axios from 'axios'
import axiosClient from './axiosClient'
import type { SiteTransfer, SiteTransferLine, SiteTransferStatus } from '../types/schema'

export interface ManagedSiteTransferLine extends SiteTransferLine {
  id: string
  material_code: string
  material_description: string
}

export interface ManagedSiteTransfer extends SiteTransfer {
  source_site_name: string
  destination_site_name: string
  lines?: ManagedSiteTransferLine[]
}

export interface SiteTransferListParams {
  tenantId: string
  sourceSiteId?: string
  destinationSiteId?: string
  status?: SiteTransferStatus | 'all'
  page?: number
  pageSize?: number
}

export interface DispatchLineInput {
  materialId: string
  quantityDispatched: number
  clientTransactionId: string
}

export interface CreateSiteTransferInput {
  sourceSiteId: string
  destinationSiteId: string
  lines: DispatchLineInput[]
}

export interface ReceiveLineInput {
  materialId: string
  quantityReceived: number
  discrepancyReason?: string | null
  clientTransactionId: string
}

interface SiteTransferListResponse {
  data: ManagedSiteTransfer[]
  pagination: { page: number; page_size: number; total: number }
}

interface SiteTransferResponse {
  data: ManagedSiteTransfer
}

interface SiteTransferErrorBody {
  message?: string
  code?: string
}

export async function fetchSiteTransfers(params: SiteTransferListParams) {
  const response = await axiosClient.get<SiteTransferListResponse>('/site-transfers', {
    params: {
      tenant_id: params.tenantId,
      source_site_id: params.sourceSiteId,
      destination_site_id: params.destinationSiteId,
      status: params.status ?? 'all',
      page: params.page,
      page_size: params.pageSize ?? 200,
    },
  })
  return response.data
}

export async function fetchSiteTransfer(tenantId: string, siteTransferId: string) {
  const response = await axiosClient.get<SiteTransferResponse>(`/site-transfers/${siteTransferId}`, {
    params: { tenant_id: tenantId },
  })
  return response.data.data
}

export async function createAndDispatchSiteTransfer(tenantId: string, input: CreateSiteTransferInput) {
  const response = await axiosClient.post<SiteTransferResponse>('/site-transfers', {
    tenant_id: tenantId,
    source_site_id: input.sourceSiteId,
    destination_site_id: input.destinationSiteId,
    lines: input.lines.map((line) => ({
      material_id: line.materialId,
      quantity_dispatched: line.quantityDispatched,
      client_transaction_id: line.clientTransactionId,
    })),
  })
  return response.data.data
}

export async function receiveSiteTransfer(tenantId: string, siteTransferId: string, lines: ReceiveLineInput[]) {
  const response = await axiosClient.patch<SiteTransferResponse>(`/site-transfers/${siteTransferId}/receive`, {
    tenant_id: tenantId,
    lines: lines.map((line) => ({
      material_id: line.materialId,
      quantity_received: line.quantityReceived,
      discrepancy_reason: line.discrepancyReason ?? null,
      client_transaction_id: line.clientTransactionId,
    })),
  })
  return response.data.data
}

export function formatSiteTransferError(error: unknown) {
  if (!axios.isAxiosError<SiteTransferErrorBody>(error)) {
    return 'The site transfer could not be saved.'
  }
  return error.response?.data?.message ?? 'The site transfer could not be saved.'
}
