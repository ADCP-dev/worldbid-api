<script setup lang="ts">
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

use([LineChart, TitleComponent, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{
  data: Array<{ date: string; visitors: number }>
}>()

const option = computed(() => ({
  tooltip: { trigger: 'axis' as const },
  grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
  xAxis: {
    type: 'category' as const,
    data: props.data.map(d => d.date.slice(5)), // MM-DD
    axisLabel: { fontSize: 11 },
  },
  yAxis: {
    type: 'value' as const,
    minInterval: 1,
  },
  series: [{
    name: 'Visitas',
    type: 'line' as const,
    data: props.data.map(d => d.visitors),
    smooth: true,
    lineStyle: { color: '#11455a', width: 2 },
    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(17, 69, 90, 0.15)' }, { offset: 1, color: 'rgba(17, 69, 90, 0)' }] } },
    itemStyle: { color: '#11455a' },
  }],
}))
</script>

<template>
  <div class="w-full h-64">
    <VChart v-if="data.length" :option="option" autoresize />
    <div v-else class="flex items-center justify-center h-full text-base-content/40 text-sm">
      Sin datos de visitas aún
    </div>
  </div>
</template>
