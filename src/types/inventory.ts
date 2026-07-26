import type { TransactionType, UOM } from './schema'

export type InventoryStatus = 'OK' | 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK'

export interface InventoryDashboardSummary {
  material_count: number
  low_stock_count: number
  critical_stock_count: number
  out_of_stock_count: number
}

export interface InventoryBalance {
  site_id: string
  material_id: string
  quantity_base_uom: number
  base_uom_id: UOM
  threshold_quantity: number | null
  status: InventoryStatus
  updated_at: string
}

export interface PendingReceipt {
  po_id: string
  po_number: string
  site_id: string
  material_id: string
  ordered_quantity_base_uom: number
  received_quantity_base_uom: number
  expected_delivery_date: string
}

export interface RecentInventoryMovement {
  transaction_id: string
  site_id: string
  material_id: string
  transaction_type: TransactionType
  quantity: number
  recorded_at: string
}

export interface InventoryDashboardData {
  summary: InventoryDashboardSummary
  balances: InventoryBalance[]
  pending_receipts: PendingReceipt[]
  recent_movements: RecentInventoryMovement[]
}

export interface InventoryDashboardResponse {
  generated_at: string
  data: InventoryDashboardData
}