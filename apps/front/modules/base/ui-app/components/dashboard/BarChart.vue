<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { use } from 'echarts/core'
import { BarChart as EBarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { BarSeries } from '@base/ui-app/components/dashboard/types'

use([
  EBarChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  CanvasRenderer,
])

const VChart = defineAsyncComponent(() => import('vue-echarts'))

const props = withDefaults(
  defineProps<{
    categories: string[]
    series: BarSeries[]
    orientation?: 'vertical' | 'horizontal'
    stacked?: boolean
    height?: string
    loading?: boolean
    altText: string
  }>(),
  {
    orientation: 'vertical',
    stacked: false,
    height: '300px',
    loading: false,
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
  const horizontal = props.orientation === 'horizontal'
  return {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
    },
    legend: {
      show: props.series.length > 1,
      textStyle: { color: themeColors.baseContent },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: horizontal
      ? { type: 'value' as const, axisLabel: { color: themeColors.baseContent, fontSize: 11 } }
      : {
          type: 'category' as const,
          data: props.categories,
          axisLabel: { color: themeColors.baseContent, fontSize: 11 },
        },
    yAxis: horizontal
      ? {
          type: 'category' as const,
          data: props.categories,
          axisLabel: { color: themeColors.baseContent, fontSize: 11 },
        }
      : { type: 'value' as const, axisLabel: { color: themeColors.baseContent, fontSize: 11 } },
    series: props.series.map((s, i) => ({
      name: s.name,
      type: 'bar' as const,
      data: s.data,
      stack: props.stacked ? 'total' : undefined,
      itemStyle: {
        color: palette.value[i % palette.value.length],
        borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
      },
    })),
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