import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { SyncStatus } from '../api/syncContracts'
import type { InventoryTransaction } from '../types/schema'

const FAILED_SYNC_RECORDS_STORAGE_KEY = 'concovecms.failed-sync-records'
const SYNC_HISTORY_STORAGE_KEY = 'concovecms.sync-history'

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

const SyncRetryContext = createContext<SyncRetryContextValue | undefined>(undefined)

function loadFailedRecords() {
  if (typeof window === 'undefined') {
    return [] as FailedSyncRecord[]
  }

  try {
    const rawValue = window.localStorage.getItem(FAILED_SYNC_RECORDS_STORAGE_KEY)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue) as unknown

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue.filter(
      (record): record is FailedSyncRecord =>
        typeof record === 'object' &&
        record !== null &&
        typeof record.client_transaction_id === 'string' &&
        typeof record.message === 'string' &&
        typeof record.tenant_id === 'string' &&
        typeof record.failed_at === 'string' &&
        typeof record.transaction === 'object' &&
        record.transaction !== null,
    )
  } catch {
    return []
  }
}

function loadSyncHistory() {
  if (typeof window === 'undefined') {
    return [] as SyncHistoryRecord[]
  }

  try {
    const rawValue = window.localStorage.getItem(SYNC_HISTORY_STORAGE_KEY)

    if (!rawValue) {
      return []
    }

    const parsedValue = JSON.parse(rawValue) as unknown

    if (!Array.isArray(parsedValue)) {
      return []
    }

    return parsedValue.filter(
      (record): record is SyncHistoryRecord =>
        typeof record === 'object' &&
        record !== null &&
        typeof record.client_transaction_id === 'string' &&
        typeof record.message === 'string' &&
        typeof record.tenant_id === 'string' &&
        typeof record.recorded_at === 'string' &&
        (record.sync_status === 'SUCCESS' || record.sync_status === 'FAILED') &&
        typeof record.transaction === 'object' &&
        record.transaction !== null,
    )
  } catch {
    return []
  }
}

function SyncRetryProvider({ children }: { children: ReactNode }) {
  const [failedRecords, setFailedRecords] = useState<FailedSyncRecord[]>(loadFailedRecords)
  const [syncHistory, setSyncHistory] = useState<SyncHistoryRecord[]>(loadSyncHistory)

  useEffect(() => {
    window.localStorage.setItem(
      FAILED_SYNC_RECORDS_STORAGE_KEY,
      JSON.stringify(failedRecords),
    )
  }, [failedRecords])

  useEffect(() => {
    window.localStorage.setItem(SYNC_HISTORY_STORAGE_KEY, JSON.stringify(syncHistory))
  }, [syncHistory])

  const upsertFailedRecords = (records: FailedSyncRecord[]) => {
    if (records.length === 0) {
      return
    }

    setFailedRecords((current) => {
      const byId = new Map(current.map((record) => [record.client_transaction_id, record]))

      records.forEach((record) => {
        byId.set(record.client_transaction_id, record)
      })

      return Array.from(byId.values()).sort((a, b) =>
        b.failed_at.localeCompare(a.failed_at),
      )
    })
  }

  const removeFailedRecord = (clientTransactionId: string) => {
    setFailedRecords((current) =>
      current.filter((record) => record.client_transaction_id !== clientTransactionId),
    )
  }

  const clearTenantSyncData = (tenantId: string) => {
    setFailedRecords((current) =>
      current.filter((record) => record.tenant_id !== tenantId),
    )
    setSyncHistory((current) => current.filter((record) => record.tenant_id !== tenantId))
  }

  const upsertSyncHistory = (records: SyncHistoryRecord[]) => {
    if (records.length === 0) {
      return
    }

    setSyncHistory((current) => {
      const byId = new Map(current.map((record) => [record.client_transaction_id, record]))

      records.forEach((record) => {
        byId.set(record.client_transaction_id, record)
      })

      return Array.from(byId.values())
        .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
        .slice(0, 100)
    })
  }

  const value = useMemo(
    () => ({
      failedRecords,
      syncHistory,
      upsertFailedRecords,
      upsertSyncHistory,
      removeFailedRecord,
      clearTenantSyncData,
      getFailedRecord: (clientTransactionId: string) =>
        failedRecords.find((record) => record.client_transaction_id === clientTransactionId),
      getSyncHistoryRecord: (clientTransactionId: string) =>
        syncHistory.find((record) => record.client_transaction_id === clientTransactionId),
    }),
    [failedRecords, syncHistory],
  )

  return <SyncRetryContext.Provider value={value}>{children}</SyncRetryContext.Provider>
}

export function useSyncRetryContext() {
  const context = useContext(SyncRetryContext)

  if (!context) {
    throw new Error('useSyncRetryContext must be used within a SyncRetryProvider')
  }

  return context
}

export default SyncRetryProvider