export function masterDataQueryKey(tenantId: string, lastSyncedAt?: string) {
  return ['master-data', tenantId, lastSyncedAt ?? null] as const
}