import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  availableTenants,
  getRequiredTenantId,
  getTenantNameById,
  setCurrentTenantId,
} from '../config/tenant'
import { TenantContext } from './useTenantContext'

function TenantProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient()
  const [selectedTenantId, setSelectedTenantId] = useState(() => {
    try {
      return getRequiredTenantId()
    } catch {
      return ''
    }
  })
  const previousTenantIdRef = useRef(selectedTenantId)

  useEffect(() => {
    setCurrentTenantId(selectedTenantId)
  }, [selectedTenantId])

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
      setSelectedTenantId,
    }),
    [selectedTenantId],
  )

  if (!selectedTenantId) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#dc2626' }}>
        <strong>Configuration Error:</strong> <code>VITE_TENANT_ID</code> is not set.
        Add it as an environment variable in your Vercel project settings.
      </div>
    )
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export default TenantProvider