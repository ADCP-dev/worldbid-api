<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { use } from 'echarts/core'
import { LineChart as ELineChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { LineSeries } from '@base/ui-app/components/dashboard/types'

use([
  ELineChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
])

const VChart = defineAsyncComponent(() => import('vue-echarts'))

const props = withDefaults(
  defineProps<{
    series: LineSeries[]
    xAxisType?: 'category' | 'time' | 'value'
    yAxisType?: 'category' | 'time' | 'value'
    height?: string
    loading?: boolean
    smooth?: boolean
    area?: boolean
    altText: string
  }>(),
  {
    height: '300px',
    loading: false,
    smooth: false,
    area: false,
  },
)

const themeColors = useThemeColors()

const palette = computed(() => [
  themeColors.primary,
  themeColors.secondary,
  themeColors.success,
  themeColors.error,
])

const option = computed(() => {
  const xData =
    props.series[0]?.data?.map((p) => p.x) ?? []
  return {
    tooltip: { trigger: 'axis' as const },
    legend: {
      show: props.series.length > 1,
      textStyle: { color: themeColors.baseContent },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: props.xAxisType ?? 'value',
      data: props.xAxisType === 'category' ? xData : undefined,
      axisLabel: { color: themeColors.baseContent, fontSize: 11 },
    },
    yAxis: {
      type: props.yAxisType ?? 'value',
      axisLabel: { color: themeColors.baseContent, fontSize: 11 },
    },
    series: props.series.map((s, i) => {
      const color = palette.value[i % palette.value.length]
      return {
        name: s.name,
        type: 'line' as const,
        data: s.data.map((p) => [p.x, p.y]),
        smooth: props.smooth,
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle: props.area
          ? {
              color: {
                type: 'linear' as const,
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: `${color}33` },
                  { offset: 1, color: `${color}00` },
                ],
              },
            }
          : undefined,
      }
    }),
  }
})
</script>

<template>
  <div class="w-full" :style="{ height }">
    <div v-if="loading" class="flex items-center justify-center h-full">
      <span class="loading loading-spinner loading-lg text-base-content/40" />
    </div>
    <template v-else>
      <div :aria-label="altText" role="img" class="h-full w-full">
        <VChart :option="option" autoresize class="h-full w-full" />
      </div>
    </template>
  </div>
</template>