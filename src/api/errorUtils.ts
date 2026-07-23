import axios from 'axios'

interface SyncStatusRecord {
  client_transaction_id: string
  sync_status: 'SUCCESS' | 'FAILED'
  message: string
}

interface MultiStatusResponse {
  results?: SyncStatusRecord[]
  sync_status?: 'SUCCESS' | 'FAILED'
  message?: string
  client_transaction_id?: string
}

function isMultiStatusBody(value: unknown): value is MultiStatusResponse {
  return typeof value === 'object' && value !== null
}

export function formatApiError(error: unknown, fallbackMessage: string) {
  if (!axios.isAxiosError(error)) {
    return fallbackMessage
  }

  const status = error.response?.status
  const data = error.response?.data

  if (status === 400 && isMultiStatusBody(data) && typeof data.message === 'string') {
    return data.message
  }

  if (status === 207 && isMultiStatusBody(data)) {
    if (Array.isArray(data.results)) {
      const failures = data.results.filter((row) => row.sync_status === 'FAILED')

      if (failures.length > 0) {
        const firstFailure = failures[0]
        return `Partial sync failure: ${firstFailure.client_transaction_id} - ${firstFailure.message}`
      }

      return 'Batch completed with multi-status response.'
    }

    if (typeof data.message === 'string') {
      return data.message
    }
  }

  return fallbackMessage
}