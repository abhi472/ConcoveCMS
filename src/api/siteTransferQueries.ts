import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { siteTransferQueryKey, siteTransfersQueryKey } from './queryKeys'
import {
  createAndDispatchSiteTransfer,
  fetchSiteTransfer,
  fetchSiteTransfers,
  receiveSiteTransfer,
  type CreateSiteTransferInput,
  type ReceiveLineInput,
  type SiteTransferListParams,
} from './siteTransferService'

export function useSiteTransfers(params: SiteTransferListParams) {
  return useQuery({
    queryKey: siteTransfersQueryKey(params.tenantId, params),
    queryFn: () => fetchSiteTransfers(params),
    placeholderData: (previousData) => previousData,
    enabled: Boolean(params.tenantId),
  })
}

export function useSiteTransfer(tenantId: string, siteTransferId: string | null) {
  return useQuery({
    queryKey: siteTransferQueryKey(tenantId, siteTransferId),
    queryFn: () => fetchSiteTransfer(tenantId, siteTransferId as string),
    enabled: Boolean(tenantId && siteTransferId),
  })
}

export function useCreateAndDispatchSiteTransfer(tenantId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSiteTransferInput) => createAndDispatchSiteTransfer(tenantId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['site-transfers', tenantId] }),
  })
}

export function useReceiveSiteTransfer(tenantId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ siteTransferId, lines }: { siteTransferId: string; lines: ReceiveLineInput[] }) =>
      receiveSiteTransfer(tenantId, siteTransferId, lines),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['site-transfers', tenantId] }),
  })
}
