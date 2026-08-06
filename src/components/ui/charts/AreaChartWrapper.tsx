import { AreaChart } from '@tremor/react'
import type { BaseChartProps } from '../../../types/analytics'

export function AreaChartWrapper({
  data,
  indexKey,
  categories,
  colors = ['indigo', 'cyan'],
  valueFormatter,
  className = 'h-72',
}: BaseChartProps) {
  return (
    <AreaChart
      className={className}
      data={data}
      index={indexKey}
      categories={categories}
      colors={colors}
      valueFormatter={valueFormatter}
      showLegend
      showGridLines={false}
    />
  )
}
