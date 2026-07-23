import type { POStatus } from '../types/schema'

interface POProgressTrackerProps {
  status: POStatus
  compact?: boolean
}

function POProgressTracker({ status, compact = false }: POProgressTrackerProps) {
  const stages: { status: POStatus; label: string; description?: string }[] = [
    { status: 'DRAFT', label: 'Draft', description: 'Order created' },
    { status: 'APPROVED', label: 'Approved', description: 'Vendor approved' },
    { status: 'PARTIALLY_FULFILLED', label: 'Partial', description: 'Partially received' },
    { status: 'COMPLETED', label: 'Completed', description: 'Fully received' },
  ]

  const stageIndex = stages.findIndex((s) => s.status === status)

  return (
    <div className={compact ? 'py-2' : 'py-4'}>
      <div className="flex items-center gap-2">
        {stages.map((stage, index) => (
          <div key={stage.status} className="flex flex-col items-center flex-1">
            {/* Stage Circle */}
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                index <= stageIndex
                  ? 'bg-amber-500 text-slate-900 shadow-sm'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {index + 1}
            </div>

            {/* Stage Label */}
            <span
              className={`mt-1 text-xs font-medium transition-colors ${
                index <= stageIndex ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              {stage.label}
            </span>

            {/* Connecting Line */}
            {index < stages.length - 1 && (
              <div
                className={`absolute h-0.5 w-[calc(25%-16px)] transition-colors ${
                  index < stageIndex ? 'bg-amber-500' : 'bg-slate-200'
                }`}
                style={{
                  left: `calc(${(index * 25) + 20}% + 16px)`,
                  top: '16px',
                }}
              />
            )}
          </div>
        ))}
      </div>

      {!compact && (
        <div className="mt-3 text-xs text-slate-600">
          <span className="font-medium">Current Status:</span> {status.replace(/_/g, ' ')}
        </div>
      )}
    </div>
  )
}

export default POProgressTracker
