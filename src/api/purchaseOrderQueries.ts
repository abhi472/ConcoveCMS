import { useMutation, useQueryClient } from '@tanstack/react-query'
import { purchaseOrdersQueryKey } from './queryKeys'
import { bulkApprovePurchaseOrders } from './purchaseOrdersService'

export function useBulkApprovePOs(tenantId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (purchaseOrderIds: string[]) => bulkApprovePurchaseOrders(tenantId, purchaseOrderIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: purchaseOrdersQueryKey(tenantId) })
    },
  })
}
