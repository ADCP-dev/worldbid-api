import type { Component } from 'vue'

export type DaisyVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export interface LineSeries {
  name: string
  data: { x: number; y: number }[]
}

export interface BarSeries {
  name: string
  data: number[]
}

export interface DonutSlice {
  name: string
  value: number
  color?: string
}

export interface TimelineEvent {
  time: Date | string
  title: string
  description?: string
  icon?: Component
  color?: DaisyVariant
}

export interface StatCardProps {
  label: string
  value: string | number
  icon?: Component
  trend?: number
  color?: DaisyVariant
  loading?: boolean
}