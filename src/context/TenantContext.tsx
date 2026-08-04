import {
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { availableTenants, getTenantNameById, setCurrentTenant } from '../config/tenant'
import { useAuthContext } from './useAuthContext'
import { TenantContext } from './useTenantContext'

function TenantProvider({ children }: PropsWithChildren) {
  const { user } = useAuthContext()
  const queryClient = useQueryClient()
  const selectedTenantId = user?.tenant_id ?? ''
  const previousTenantIdRef = useRef(selectedTenantId)

  useEffect(() => {
    if (!user) {
      setCurrentTenant(null)
      return
    }

    setCurrentTenant({
      id: user.tenant_id,
      name: user.tenant_name || import.meta.env.VITE_TENANT_NAME || getTenantNameById(user.tenant_id),
    })
  }, [user])

  useEffect(() => {
    if (previousTenantIdRef.current === selectedTenantId) {
      return
    }

    previousTenantIdRef.current = selectedTenantId

    void (async () => {
      await queryClient.cancelQueries({ queryKey: ['master-data'] })
      queryClient.removeQueries({ queryKey: ['master-data'] })
      await queryClient.invalidateQueries({ queryKey: ['master-data'] })
    })()
  }, [queryClient, selectedTenantId])

  const value = useMemo(
    () => ({
      selectedTenantId,
      selectedTenantName: getTenantNameById(selectedTenantId),
      availableTenants,
      setSelectedTenantId: () => {},
    }),
    [selectedTenantId],
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export default TenantProvider