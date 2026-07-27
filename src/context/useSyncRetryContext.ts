import { createContext, useContext } from 'react'
import type { SyncStatus } from '../api/syncContracts'
import type { InventoryTransaction } from '../types/schema'

export interface FailedSyncRecord {
  client_transaction_id: string
  message: string
  tenant_id: string
  failed_at: string
  transaction: InventoryTransaction
}

export interface SyncHistoryRecord {
  client_transaction_id: string
  message: string
  tenant_id: string
  recorded_at: string
  sync_status: SyncStatus
  transaction: InventoryTransaction
}

interface SyncRetryContextValue {
  failedRecords: FailedSyncRecord[]
  syncHistory: SyncHistoryRecord[]
  upsertFailedRecords: (records: FailedSyncRecord[]) => void
  upsertSyncHistory: (records: SyncHistoryRecord[]) => void
  removeFailedRecord: (clientTransactionId: string) => void
  clearTenantSyncData: (tenantId: string) => void
  getFailedRecord: (clientTransactionId: string) => FailedSyncRecord | undefined
  getSyncHistoryRecord: (clientTransactionId: string) => SyncHistoryRecord | undefined
}

export const SyncRetryContext = createContext<SyncRetryContextValue | undefined>(undefined)

export function useSyncRetryContext() {
  const context = useContext(SyncRetryContext)

  if (!context) {
    throw new Error('useSyncRetryContext must be used within a SyncRetryProvider')
  }

  return context
}