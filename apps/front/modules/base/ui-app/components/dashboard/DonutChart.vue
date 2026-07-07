<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { use } from 'echarts/core'
import { PieChart as EPieChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { DonutSlice } from '@base/ui-app/components/dashboard/types'
import EmptyState from '@base/ui-app/components/dashboard/EmptyState.vue'
import { PieChart as PieIcon } from 'lucide-vue-next'

use([
  EPieChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
])

const VChart = defineAsyncComponent(() => import('vue-echarts'))

const props = withDefaults(
  defineProps<{
    data: DonutSlice[]
    height?: string
    showLegend?: boolean
    loading?: boolean
    centerLabel?: string
    altText: string
  }>(),
  {
    height: '300px',
    showLegend: true,
    loading: false,
  },
)

const { t } = useI18n()

const themeColors = useThemeColors()

const palette = computed(() => [
  themeColors.primary,
  themeColors.secondary,
  themeColors.success,
  themeColors.error,
])

const isEmpty = computed(() => props.data.length === 0)

const option = computed(() => {
  return {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number }
        return `${p.name}: ${p.value} (${p.percent}%)`
      },
    },
    legend: {
      show: props.showLegend,
      bottom: 0,
      textStyle: { color: themeColors.baseContent },
    },
    series: [
      {
        type: 'pie' as const,
        radius: ['45%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        label: {
          show: !!props.centerLabel,
          position: 'center' as const,
          formatter: props.centerLabel ?? '',
          fontSize: 18,
          fontWeight: 'bold',
          color: themeColors.baseContent,
        },
        data: props.data.map((d, i) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color ?? palette.value[i % palette.value.length] },
        })),
      },
    ],
  }
})
</script>

<template>
  <div class="w-full" :style="{ height }">
    <div v-if="loading" class="flex items-center justify-center h-full">
      <span class="loading loading-spinner loading-lg text-base-content/40" />
    </div>
    <EmptyState
      v-else-if="isEmpty"
      :icon="PieIcon"
      :title="t('base-ui.dashboard.donutEmpty')"
      :description="t('base-ui.dashboard.donutEmptyDesc')"
      size="sm"
    />
    <div v-else :aria-label="altText" role="img" class="h-full w-full">
      <VChart :option="option" autoresize class="h-full w-full" />
    </div>
  </div>
</template>