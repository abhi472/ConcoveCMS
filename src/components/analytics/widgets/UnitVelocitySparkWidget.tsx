import { MetricCardWrapper } from '../../ui/charts/MetricCardWrapper'
import type { AnalyticsSummary } from '../../../types/analytics'

interface UnitVelocitySparkWidgetProps {
  summary?: AnalyticsSummary
  isLoading?: boolean
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
  }).format(value)
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function toLakh(value: number) {
  return `INR ${(value / 100000).toFixed(1)}L`
}

export function UnitVelocitySparkWidget({ summary, isLoading = false }: UnitVelocitySparkWidgetProps) {
  if (isLoading) {
    return (
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </section>
    )
  }

  const inward = summary?.seven_day_inward_units ?? 0
  const outward = summary?.seven_day_outward_units ?? 0
  const fulfillmentRatio = summary?.fulfillment_ratio_percent ?? 0
  const projectedSpend = summary?.projected_spend_month ?? 0
  const throughputDelta = inward - outward

  const throughputBadge = throughputDelta >= 0
    ? { value: `+${formatCompactNumber(throughputDelta)}`, type: 'increase' as const }
    : { value: formatCompactNumber(throughputDelta), type: 'decrease' as const }

  const fulfillmentBadge = fulfillmentRatio >= 85
    ? { value: 'Healthy', type: 'increase' as const }
    : fulfillmentRatio >= 70
      ? { value: 'Watch', type: 'moderateDecrease' as const }
      : { value: 'Critical', type: 'decrease' as const }

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCardWrapper
        title="7D Inward Units"
        metric={formatCompactNumber(inward)}
        delta={throughputBadge}
        subtitle="Recent inward movement"
      />
      <MetricCardWrapper
        title="7D Outward Units"
        metric={formatCompactNumber(outward)}
        subtitle="Recent outward consumption"
      />
      <MetricCardWrapper
        title="Fulfillment Ratio"
        metric={formatPercent(fulfillmentRatio)}
        delta={fulfillmentBadge}
        subtitle="PO fulfilled vs allocated"
      />
      <MetricCardWrapper
        title="Projected Spend"
        metric={toLakh(projectedSpend)}
        subtitle="Current month from transaction commercials"
      />
    </section>
  )
}
