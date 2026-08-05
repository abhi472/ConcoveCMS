export const TENANT_ID = 'test-tenant-0001'

export const SITE_ALPHA = {
  id: 'site-alpha',
  tenant_id: TENANT_ID,
  entity_type: 'INTERNAL_SITE' as const,
  name: 'Site Alpha',
}

export const SITE_BETA = {
  id: 'site-beta',
  tenant_id: TENANT_ID,
  entity_type: 'INTERNAL_SITE' as const,
  name: 'Site Beta',
}

export const VENDOR_ACME = {
  id: 'vendor-acme',
  tenant_id: TENANT_ID,
  entity_type: 'VENDOR' as const,
  name: 'Acme Supplies',
}

export const ENTITIES = [SITE_ALPHA, SITE_BETA, VENDOR_ACME]

export const MATERIAL_CEMENT = {
  id: 'mat-cement',
  material_code: 'CEMENT-OPC43',
  description: 'OPC 43 Grade Cement',
  base_uom_id: 'BAG',
  issue_uom_id: 'BAG',
  conversion_factor: 1,
}

export const MATERIAL_STEEL = {
  id: 'mat-steel',
  material_code: 'STEEL-REBAR-8MM',
  description: 'Steel Rebar 8mm',
  base_uom_id: 'KG',
  issue_uom_id: 'KG',
  conversion_factor: 1,
}

export const MATERIALS = [MATERIAL_CEMENT, MATERIAL_STEEL]
