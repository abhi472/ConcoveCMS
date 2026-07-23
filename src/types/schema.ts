export type UOM = 'LITER' | 'KG' | 'BAG' | 'TON' | 'PIECE' | 'METER'

export type EntityType = 'VENDOR' | 'INTERNAL_SITE' | 'SUBCONTRACTOR' | 'EMPLOYEE'

export type POStatus = 'DRAFT' | 'APPROVED' | 'PARTIALLY_FULFILLED' | 'COMPLETED'

export type TransactionType = 'INWARD' | 'OUTWARD' | 'IST_DISPATCH' | 'IST_RECEIPT'

export interface Material {
  id: string
  material_code: string
  description: string
  base_uom_id: UOM
  issue_uom_id: UOM
  conversion_factor: number
  created_at?: string
  updated_at?: string
}

export interface Entity {
  id: string
  tenant_id: string
  entity_type: EntityType
  name: string
  created_at?: string
  updated_at?: string
}

export interface POItem {
  id?: string
  material_id: string
  ordered_quantity_base_uom: number
  unit_rate: number
}

export interface PurchaseOrder {
  id: string
  po_number: string
  vendor_id: string
  target_site_id: string
  status: POStatus
  expected_delivery_date: string
  items?: POItem[]
  created_at?: string
  updated_at?: string
}

export interface InventoryTransaction {
  client_transaction_id: string
  site_id: string
  material_id: string
  po_id: string | null
  transaction_type: TransactionType
  quantity: number
  source_entity_id: string | null
  destination_entity_id: string | null
  transaction_date: string
  correction_of_transaction_id?: string
  correction_reason?: string
  commercial_details?: {
    invoice_no: string
    base_rate: number
    gst_tier: number
    transport_charges: number
  }
  volumetric_details?: {
    length: number
    breadth: number
    height: number
    loaded_weight: number
    empty_weight: number
  }
}