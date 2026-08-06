import { BadgeDelta, Card, Metric, Text } from '@tremor/react'
import type { MetricCardProps } from '../../../types/analytics'

export function MetricCardWrapper({
  title,
  metric,
  delta,
  subtitle,
}: MetricCardProps) {
  return (
    <Card className="rounded-xl border border-slate-200 p-4">
      <Text className="text-xs font-medium uppercase tracking-wider text-slate-500">{title}</Text>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <Metric className="text-2xl font-bold text-slate-900">{metric}</Metric>
        {delta ? (
          <BadgeDelta deltaType={delta.type} size="xs">
            {delta.value}
          </BadgeDelta>
        ) : null}
      </div>
      {subtitle ? <Text className="mt-1 text-xs text-slate-500">{subtitle}</Text> : null}
    </Card>
  )
}
