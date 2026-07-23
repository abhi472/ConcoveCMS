interface MaterialCodeNormalizerProps {
  originalCode: string
  normalizedCode: string
}

function MaterialCodeNormalizer({ originalCode, normalizedCode }: MaterialCodeNormalizerProps) {
  const isIdentical = originalCode === normalizedCode

  return (
    <div className="mt-2 rounded-md bg-slate-50 p-2.5 border border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium text-slate-600">Input</p>
          <p className="mt-1 font-mono text-sm text-slate-900 break-all">
            {originalCode || <span className="text-slate-400">—</span>}
          </p>
        </div>

        <div className="mx-3 text-slate-400">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 10l-4.293-4.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <div className="flex-1 text-right">
          <p className="text-xs font-medium text-slate-600">Normalized</p>
          <p
            className={`mt-1 font-mono text-sm break-all ${
              isIdentical
                ? 'text-slate-900'
                : 'text-amber-600 font-semibold bg-amber-50 px-2 py-1 rounded'
            }`}
          >
            {normalizedCode || <span className="text-slate-400">—</span>}
          </p>
        </div>
      </div>

      {!isIdentical && originalCode && (
        <p className="mt-2 text-xs text-slate-600">
          ✓ Automatically converted to lowercase kebab-case
        </p>
      )}
    </div>
  )
}

export default MaterialCodeNormalizer
