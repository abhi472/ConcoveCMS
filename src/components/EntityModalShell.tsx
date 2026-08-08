import type { PropsWithChildren, ReactNode } from 'react'

type EntityModalShellProps = PropsWithChildren<{
  titleId: string
  title: ReactNode
  subtitle?: ReactNode
  maxWidthClassName: string
  onClose: () => void
  ariaLabel?: string
  alert?: boolean
}>

function EntityModalShell({
  titleId,
  title,
  subtitle,
  maxWidthClassName,
  onClose,
  ariaLabel,
  alert = false,
  children,
}: EntityModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"
      role={alert ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-label={ariaLabel}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={`h-full w-full overflow-y-auto bg-white p-6 shadow-xl ${maxWidthClassName}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h3>
            {subtitle ? <div className="mt-1 text-sm text-slate-600">{subtitle}</div> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="text-2xl text-slate-500">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default EntityModalShell