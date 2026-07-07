<script setup lang="ts">
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([BarChart, TitleComponent, TooltipComponent, GridComponent, CanvasRenderer])

const props = defineProps<{
  data: Array<{ source: string; count: number }>
}>()
const theme = useThemeColors()

const option = computed(() => ({
  tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  xAxis: { type: 'value' as const },
  yAxis: {
    type: 'category' as const,
    data: props.data.map(d => d.source),
    axisLabel: { fontSize: 12 },
  },
  series: [{
    name: 'Visitas',
    type: 'bar' as const,
    data: props.data.map(d => d.count),
    itemStyle: { color: theme.primary, borderRadius: [0, 4, 4, 0] },
  }],
}))
</script>

<template>
  <div class="w-full h-64">
    <VChart v-if="data.length" :option="option" autoresize />
    <div v-else class="flex items-center justify-center h-full text-base-content/40 text-sm">
      Sin datos de fuentes
    </div>
  </div>
</template>
