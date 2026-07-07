<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import CronScheduleEditor from '@/modules/base/ui-app/components/scheduling/CronScheduleEditor.vue';
import WeekdayPicker from '@/modules/base/ui-app/components/form/WeekdayPicker.vue';
import TimeWindowPicker from '@/modules/base/ui-app/components/form/TimeWindowPicker.vue';
import NumericStepper from '@/modules/base/ui-app/components/form/NumericStepper.vue';
import type { TimeWindow } from '@/modules/base/ui-app/components/scheduling/types';

definePageMeta({
  layout: 'default',
});

const { t } = useI18n();

// --- CronScheduleEditor state (one per simple mode + advanced) ---------------
const cronEveryN = ref('*/10 * * * *');
const cronDaily = ref('0 9 * * *');
const cronWeekly = ref('0 9 * * 1,5');
const cronMonthly = ref('0 9 15 * *');
const cronAdvanced = ref('0 9,12,18 * * *');

// --- WeekdayPicker state -----------------------------------------------------
const weekdays = ref<number[]>([1, 3, 5]);

// --- TimeWindowPicker state --------------------------------------------------
const timeWindow = ref<TimeWindow>({
  start: '09:00',
  end: '17:00',
  timezone: 'Europe/Madrid',
});

// --- NumericStepper state ----------------------------------------------------
const stepperValue = ref(15);

const propDocs = [
  {
    component: 'CronScheduleEditor',
    props: 'modelValue, label, description?, error?, required?, disabled?, timezone?, allowAdvanced?',
    slots: 'hint',
    usage: '<BaseSchedulingCronScheduleEditor v-model="cron" label="Cron" timezone="user" />',
  },
  {
    component: 'WeekdayPicker',
    props: 'modelValue, label?, firstDayOfWeek?, presets?, disabled?',
    slots: '—',
    usage: '<WeekdayPicker v-model="days" label="Días" />',
  },
  {
    component: 'TimeWindowPicker',
    props: 'modelValue, label?, error?, disabled?',
    slots: '—',
    usage: '<TimeWindowPicker v-model="window" label="Ventana" />',
  },
  {
    component: 'NumericStepper',
    props: 'modelValue, min?, max?, step?, label?, description?, error?, required?, disabled?, unit?',
    slots: 'hint',
    usage: '<NumericStepper v-model="n" :min="1" :max="59" :step="5" unit="minutos" />',
  },
];
</script>

<template>
  <div class="container mx-auto py-10 px-4">
    <div class="max-w-3xl mx-auto flex flex-col gap-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight mb-2">
          {{ t('base.app.scheduling.cron.preview') }} — Scheduling
        </h1>
        <p class="text-base-content/60">
          Componentes de programación: CronScheduleEditor, WeekdayPicker,
          TimeWindowPicker y NumericStepper.
        </p>
      </div>

      <!-- CronScheduleEditor: every-n-minutes -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-2">CronScheduleEditor — Cada N minutos</h2>
          <CronScheduleEditor
            v-model="cronEveryN"
            label="Frecuencia de actualización"
            description="Cada cuántos minutos se ejecuta la tarea."
          />
          <div class="mt-3 text-sm text-base-content/60">
            Cron: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ cronEveryN }}</span>
          </div>
        </div>
      </div>

      <!-- CronScheduleEditor: daily-at -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-2">CronScheduleEditor — Diario a las</h2>
          <CronScheduleEditor
            v-model="cronDaily"
            label="Reporte diario"
          />
          <div class="mt-3 text-sm text-base-content/60">
            Cron: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ cronDaily }}</span>
          </div>
        </div>
      </div>

      <!-- CronScheduleEditor: weekly-on -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-2">CronScheduleEditor — Semanal</h2>
          <CronScheduleEditor
            v-model="cronWeekly"
            label="Sincronización semanal"
            timezone="user"
          />
          <div class="mt-3 text-sm text-base-content/60">
            Cron: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ cronWeekly }}</span>
          </div>
        </div>
      </div>

      <!-- CronScheduleEditor: monthly-on -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-2">CronScheduleEditor — Mensual</h2>
          <CronScheduleEditor
            v-model="cronMonthly"
            label="Facturación mensual"
          />
          <div class="mt-3 text-sm text-base-content/60">
            Cron: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ cronMonthly }}</span>
          </div>
        </div>
      </div>

      <!-- CronScheduleEditor: advanced -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-2">CronScheduleEditor — Modo avanzado</h2>
          <CronScheduleEditor
            v-model="cronAdvanced"
            label="Cron personalizado"
            description="Cadena cron no encaja en modos simples → modo avanzado automático."
          />
          <div class="mt-3 text-sm text-base-content/60">
            Cron: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ cronAdvanced }}</span>
          </div>
        </div>
      </div>

      <!-- WeekdayPicker -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-2">WeekdayPicker</h2>
          <WeekdayPicker
            v-model="weekdays"
            label="Días de interacción"
          />
          <div class="mt-3 text-sm text-base-content/60">
            Días (ISO): <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ weekdays.join(', ') }}</span>
          </div>
        </div>
      </div>

      <!-- TimeWindowPicker -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-2">TimeWindowPicker</h2>
          <TimeWindowPicker
            v-model="timeWindow"
            label="Ventana de publicación"
          />
          <div class="mt-3 text-sm text-base-content/60">
            Valor: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ JSON.stringify(timeWindow) }}</span>
          </div>
        </div>
      </div>

      <!-- NumericStepper -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-2">NumericStepper</h2>
          <NumericStepper
            v-model="stepperValue"
            :min="1"
            :max="59"
            :step="5"
            label="Intervalo de comprobación"
            unit="minutos"
          />
          <div class="mt-3 text-sm text-base-content/60">
            Valor: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ stepperValue }}</span>
          </div>
        </div>
      </div>

      <!-- Props/slots reference table -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-4">Props, slots y uso</h2>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Componente</th>
                  <th>Props</th>
                  <th>Slots</th>
                  <th>Uso</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in propDocs" :key="row.component">
                  <td class="font-mono">{{ row.component }}</td>
                  <td class="font-mono text-xs">{{ row.props }}</td>
                  <td class="font-mono text-xs">{{ row.slots }}</td>
                  <td class="font-mono text-xs">{{ row.usage }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>