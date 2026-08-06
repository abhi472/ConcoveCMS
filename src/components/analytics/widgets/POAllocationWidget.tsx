import { BarChartWrapper } from '../../ui/charts/BarChartWrapper'
import type { ChartDataPoint } from '../../../types/analytics'

const defaultPOAllocationData: ChartDataPoint[] = [
  { date: 'CEMENT-OPC', Allocated: 780, Fulfilled: 620 },
  { date: 'STEEL-TMT', Allocated: 560, Fulfilled: 540 },
  { date: 'SAND-MED', Allocated: 430, Fulfilled: 300 },
  { date: 'AGGR-20MM', Allocated: 390, Fulfilled: 365 },
  { date: 'BIT-60/70', Allocated: 220, Fulfilled: 145 },
]

interface POAllocationWidgetProps {
  data?: ChartDataPoint[]
  isLoading?: boolean
}

export function POAllocationWidget({
  data = defaultPOAllocationData,
  isLoading = false,
}: POAllocationWidgetProps) {
  if (isLoading) {
    return <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
  }

  const normalizedData = data.map((point) => ({
    ...point,
    Allocated: Number(point.Allocated ?? 0),
    Fulfilled: Number(point.Fulfilled ?? 0),
  }))

  const totals = normalizedData.reduce(
    (acc, point) => ({
      allocated: acc.allocated + Number(point.Allocated ?? 0),
      fulfilled: acc.fulfilled + Number(point.Fulfilled ?? 0),
    }),
    { allocated: 0, fulfilled: 0 },
  )

  const completion = totals.allocated > 0
    ? (totals.fulfilled / totals.allocated) * 100
    : 0
  const hasAnyAllocation = totals.allocated > 0

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">PO Allocation vs Fulfillment</h3>
          <p className="text-xs text-slate-500">Material-level fulfillment gap highlights</p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 font-semibold text-sky-700">
            Allocated {totals.allocated.toLocaleString()}
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
            {completion.toFixed(1)}% fulfilled
          </span>
        </div>
      </header>
      {hasAnyAllocation ? (
        <BarChartWrapper
          data={normalizedData}
          indexKey="date"
          categories={['Allocated', 'Fulfilled']}
          colors={['sky', 'emerald']}
          valueFormatter={(value) => `${value.toLocaleString()} units`}
        />
      ) : (
        <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
          <div>
            <p className="text-sm font-semibold text-slate-700">No PO allocation data in this scope</p>
            <p className="mt-1 text-xs text-slate-500">Use all-site scope or widen the analytics window.</p>
          </div>
        </div>
      )}
    </section>
  )
}
