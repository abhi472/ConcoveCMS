export interface ChartDataPoint {
  date: string
  [key: string]: string | number
}

export interface BaseChartProps {
  data: ChartDataPoint[]
  indexKey: string
  categories: string[]
  colors?: string[]
  valueFormatter?: (value: number) => string
  className?: string
}

export interface MetricCardProps {
  title: string
  metric: string | number
  delta?: {
    value: string
    type: 'increase' | 'decrease' | 'moderateIncrease' | 'moderateDecrease' | 'unchanged'
  }
  subtitle?: string
}

export interface AnalyticsSummary {
  seven_day_inward_units: number
  seven_day_outward_units: number
  fulfillment_ratio_percent: number
  projected_spend_month: number
}

export interface AnalyticsOverviewData {
  range_days: number
  summary: AnalyticsSummary
  material_usage: ChartDataPoint[]
  po_allocation: ChartDataPoint[]
}

export interface AnalyticsOverviewResponse {
  generated_at: string
  data: AnalyticsOverviewData
}
