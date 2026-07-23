import type { InventoryTransaction } from '../types/schema'

export type SyncStatus = 'SUCCESS' | 'FAILED'

export type BatchTransactionItem = InventoryTransaction

export interface BatchTransactionRequest {
  transactions: BatchTransactionItem[]
}

export interface FluidDispenseRequest {
  client_transaction_id: string
  site_id: string
  vehicle_id: string
  material_id: string
  dispense_quantity: number
  logged_at: string
}

export interface SyncRecordStatus {
  client_transaction_id: string
  sync_status: SyncStatus
  message: string
}

export interface BatchSyncResponse {
  results: SyncRecordStatus[]
}

export interface FluidDispenseResponse {
  client_transaction_id: string
  sync_status: SyncStatus
  message: string
}