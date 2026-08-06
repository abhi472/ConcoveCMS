import { AreaChartWrapper } from '../../ui/charts/AreaChartWrapper'
import type { ChartDataPoint } from '../../../types/analytics'

const defaultMaterialUsageData: ChartDataPoint[] = [
  { date: 'Aug 01', INWARD: 420, OUTWARD: 250 },
  { date: 'Aug 02', INWARD: 380, OUTWARD: 290 },
  { date: 'Aug 03', INWARD: 450, OUTWARD: 320 },
  { date: 'Aug 04', INWARD: 490, OUTWARD: 360 },
  { date: 'Aug 05', INWARD: 460, OUTWARD: 395 },
  { date: 'Aug 06', INWARD: 520, OUTWARD: 410 },
  { date: 'Aug 07', INWARD: 505, OUTWARD: 430 },
]

interface MaterialUsageWidgetProps {
  siteLabel?: string
  data?: ChartDataPoint[]
  isLoading?: boolean
}

export function MaterialUsageWidget({
  siteLabel,
  data = defaultMaterialUsageData,
  isLoading = false,
}: MaterialUsageWidgetProps) {
  if (isLoading) {
    return <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
  }

  const normalizedData = data.map((point) => {
    const rawDate = String(point.date)
    const parsed = new Date(rawDate)
    const label = Number.isNaN(parsed.getTime())
      ? rawDate
      : new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit' }).format(parsed)
    return {
      ...point,
      date: label,
      INWARD: Number(point.INWARD ?? 0),
      OUTWARD: Number(point.OUTWARD ?? 0),
    }
  })

  const totals = normalizedData.reduce(
    (acc, point) => ({
      inward: acc.inward + Number(point.INWARD ?? 0),
      outward: acc.outward + Number(point.OUTWARD ?? 0),
    }),
    { inward: 0, outward: 0 },
  )

  const hasAnyMovement = totals.inward > 0 || totals.outward > 0

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Material Consumption Velocity</h3>
          <p className="text-xs text-slate-500">
            {siteLabel ? `Site scoped analytics for ${siteLabel}` : 'Cross-site inward vs outward trend'}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
            Inward {totals.inward.toLocaleString()}
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 font-semibold text-amber-700">
            Outward {totals.outward.toLocaleString()}
          </span>
        </div>
      </header>
      {hasAnyMovement ? (
        <AreaChartWrapper
          data={normalizedData}
          indexKey="date"
          categories={['INWARD', 'OUTWARD']}
          colors={['emerald', 'amber']}
          valueFormatter={(value) => `${value.toLocaleString()} units`}
        />
      ) : (
        <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
          <div>
            <p className="text-sm font-semibold text-slate-700">No movement data in this window</p>
            <p className="mt-1 text-xs text-slate-500">Try a wider date range or switch site scope.</p>
          </div>
        </div>
      )}
    </section>
  )
}
