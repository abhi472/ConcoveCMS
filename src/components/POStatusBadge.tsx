import type { POApprovalStatus } from '../types/schema'

const PO_STATUS_BADGE_STYLES: Record<POApprovalStatus, string> = {
  DRAFT: 'bg-slate-200 text-slate-600',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
  PARTIAL_RECEIPT: 'bg-sky-100 text-sky-800',
  FULFILLED: 'bg-teal-100 text-teal-800',
  CANCELLED: 'bg-rose-100 text-rose-700',
}

const PO_STATUS_LABELS: Record<POApprovalStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  PARTIAL_RECEIPT: 'Partial Receipt',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled',
}

export function POStatusBadge({ status }: { status: POApprovalStatus }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${PO_STATUS_BADGE_STYLES[status]}`}>
      {PO_STATUS_LABELS[status]}
    </span>
  )
}

