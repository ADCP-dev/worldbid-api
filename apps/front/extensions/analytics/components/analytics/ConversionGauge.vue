<script setup lang="ts">
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'

use([GaugeChart, CanvasRenderer])

const props = defineProps<{ value: number }>()

const option = computed(() => ({
  series: [{
    type: 'gauge',
    startAngle: 210,
    endAngle: -30,
    min: 0,
    max: 100,
    axisLine: {
      lineStyle: {
        width: 20,
        color: [
          [0.3, '#33a67d'],
          [0.7, '#11455a'],
          [1, '#e0e0e0'],
        ],
      },
    },
    pointer: { length: '70%', width: 6, itemStyle: { color: '#11455a' } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: { show: false },
    detail: {
      valueAnimation: true,
      formatter: '{value}%',
      fontSize: 28,
      fontWeight: 'bold',
      color: '#11455a',
      offsetCenter: [0, '60%'],
    },
    title: {
      offsetCenter: [0, '85%'],
      fontSize: 12,
      color: '#78716c',
    },
    data: [{ value: props.value, name: 'Conversión' }],
  }],
}))
</script>

<template>
  <div class="w-full h-64 flex items-center justify-center">
    <VChart :option="option" autoresize style="width: 100%; height: 100%" />
  </div>
</template>
