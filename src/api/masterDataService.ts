import axiosClient from './axiosClient'
import { getRequiredTenantId } from '../config/tenant'
import type { Entity, Material, PurchaseOrder } from '../types/schema'

export interface MasterDataPayload {
  materials: Material[]
  entities: Entity[]
  purchase_orders: PurchaseOrder[]
}

export interface MasterDataResponse {
  sync_timestamp: string
  data: MasterDataPayload
}

export interface FetchMasterDataParams {
  tenantId?: string
  lastSyncedAt?: string
}

export async function fetchMasterData(params?: FetchMasterDataParams) {
  const tenantId = params?.tenantId ?? getRequiredTenantId()

  const response = await axiosClient.get<MasterDataResponse>('/sync/master-data', {
    params: {
      tenant_id: tenantId,
      last_synced_at: params?.lastSyncedAt,
    },
  })

  return response.data
}