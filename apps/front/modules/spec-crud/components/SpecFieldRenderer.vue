<script setup lang="ts">
import { computed } from 'vue'
import type { FieldSpec } from '../composables/useSpecResource'

const props = defineProps<{
  /** Field value to render */
  value: unknown
  /** Field spec with UI hints */
  field: FieldSpec
  /** Full row record — needed for avatar/link patterns that reference other fields */
  row?: Record<string, unknown>
}>()

const ui = computed(() => props.field.ui ?? {})
const display = computed(() => ui.value.display ?? 'text')

/* ---------- text ---------- */
const displayText = computed(() => {
  if (props.value === null || props.value === undefined) return ''
  return String(props.value)
})

/* ---------- date ---------- */
const formattedDate = computed(() => {
  if (!props.value) return ''
  const d = new Date(props.value as string)
  if (Number.isNaN(d.getTime())) return String(props.value)
  const fmt = ui.value.dateFormat
  if (fmt) {
    try {
      return new Intl.DateTimeFormat(undefined, JSON.parse(fmt)).format(d)
    } catch {
      // fall through to default
    }
  }
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
})

/* ---------- badge ---------- */
const badgeClass = computed(() => {
  const colors = ui.value.colors ?? {}
  const key = String(props.value)
  return colors[key] ?? 'badge-ghost'
})

/* ---------- avatar ---------- */
const avatarImage = computed(() => {
  const imgField = ui.value.avatarImageField
  if (imgField && props.row) return props.row[imgField] as string | undefined
  return undefined
})
const avatarLetter = computed(() => {
  const txt = displayText.value
  return txt ? txt.charAt(0).toUpperCase() : '?'
})

/* ---------- truncate ---------- */
const truncateLength = computed(() => ui.value.truncateLength ?? 30)
const truncatedText = computed(() => {
  const txt = displayText.value
  if (txt.length <= truncateLength.value) return txt
  return txt.slice(0, truncateLength.value) + '…'
})

/* ---------- link ---------- */
const linkHref = computed(() => {
  const pattern = ui.value.linkPattern
  if (!pattern) return '#'
  if (!props.row) return '#'
  return pattern.replace(/\{(\w+)\}/g, (_, key: string) =>
    props.row ? String(props.row[key] ?? '') : '',
  )
})
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <!-- text -->
    <template v-if="display === 'text'">
      {{ displayText }}
    </template>

    <!-- badge -->
    <span
      v-else-if="display === 'badge'"
      class="badge badge-sm"
      :class="badgeClass"
    >
      {{ displayText }}
    </span>

    <!-- date -->
    <time v-else-if="display === 'date'" :datetime="String(value)">
      {{ formattedDate }}
    </time>

    <!-- avatar -->
    <span v-else-if="display === 'avatar'" class="inline-flex items-center gap-2">
      <span class="avatar avatar-placeholder">
        <span class="w-8 rounded-full bg-neutral text-neutral-content">
          <img
            v-if="avatarImage"
            :src="avatarImage"
            :alt="displayText"
            class="rounded-full"
          >
          <span v-else class="text-sm font-semibold">{{ avatarLetter }}</span>
        </span>
      </span>
      <span class="text-sm">{{ displayText }}</span>
    </span>

    <!-- truncate -->
    <span
      v-else-if="display === 'truncate'"
      class="block max-w-xs truncate"
      :title="displayText"
    >
      {{ truncatedText }}
    </span>

    <!-- icon -->
    <span v-else-if="display === 'icon'" class="inline-flex items-center gap-1.5">
      <svg
        class="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        />
        <path d="M14 2v6h6" />
      </svg>
      <span class="text-sm">{{ displayText }}</span>
    </span>

    <!-- link -->
    <NuxtLink
      v-else-if="display === 'link'"
      :to="linkHref"
      class="link link-primary text-sm"
    >
      {{ displayText }}
    </NuxtLink>

    <!-- fallback -->
    <template v-else>{{ displayText }}</template>
  </span>
</template>