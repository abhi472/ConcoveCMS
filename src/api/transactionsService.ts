import axiosClient from './axiosClient'
import type {
  BatchSyncResponse,
  BatchTransactionRequest,
  FluidDispenseRequest,
  FluidDispenseResponse,
} from './syncContracts'

export async function syncTransactionsBatch(payload: BatchTransactionRequest) {
  const response = await axiosClient.post<BatchSyncResponse>(
    '/sync/transactions/batch',
    payload,
  )

  return response.data
}

export async function createFluidDispense(payload: FluidDispenseRequest) {
  const response = await axiosClient.post<FluidDispenseResponse>(
    '/inventory/fluid-dispense',
    payload,
  )

  return response.data
}