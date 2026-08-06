import { BarChart } from '@tremor/react'
import type { BaseChartProps } from '../../../types/analytics'

export function BarChartWrapper({
  data,
  indexKey,
  categories,
  colors = ['blue'],
  valueFormatter,
  className = 'h-72',
}: BaseChartProps) {
  return (
    <BarChart
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
