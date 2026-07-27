import { createContext, useContext } from 'react'

interface TenantContextValue {
  selectedTenantId: string
  selectedTenantName: string
  availableTenants: { id: string; name: string }[]
  setSelectedTenantId: (tenantId: string) => void
}

export const TenantContext = createContext<TenantContextValue | null>(null)

export function useTenantContext() {
  const context = useContext(TenantContext)

  if (!context) {
    throw new Error('useTenantContext must be used within TenantProvider')
  }

  return context
}