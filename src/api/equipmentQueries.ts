import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invalidateTenantLookupAndSummaryData } from './cacheInvalidation'
import { equipmentQueryKey } from './queryKeys'
import {
  createEquipment,
  fetchEquipment,
  updateEquipment,
  type EquipmentInput,
  type EquipmentListParams,
} from './equipmentService'

export function useEquipment(params: EquipmentListParams) {
  return useQuery({
    queryKey: equipmentQueryKey(params.tenantId, params),
    queryFn: () => fetchEquipment(params),
    placeholderData: (previousData) => previousData,
  })
}

export function useCreateEquipment(tenantId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EquipmentInput) => createEquipment(tenantId, input),
    onSuccess: async () => {
      await invalidateTenantLookupAndSummaryData(queryClient, tenantId)
      await queryClient.invalidateQueries({ queryKey: ['equipment', tenantId] })
    },
  })
}

export function useUpdateEquipment(tenantId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ equipmentId, input }: { equipmentId: string; input: EquipmentInput }) =>
      updateEquipment(tenantId, equipmentId, input),
    onSuccess: async () => {
      await invalidateTenantLookupAndSummaryData(queryClient, tenantId)
      await queryClient.invalidateQueries({ queryKey: ['equipment', tenantId] })
    },
  })
}
