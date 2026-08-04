<script setup lang="ts">
import { computed } from 'vue'
import { type FieldSpec, refResource, refLabelField } from '../composables/useSpecResource'
import { useRefResolver, type RefDisplay } from '../composables/useRefResolver'

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

/* ---------- ref resolution ---------- */
/**
 * When the field is a `ref` (e.g. assigneeId → user), the value is a raw
 * integer FK. We resolve it to a display object (label, avatar, initials)
 * via the shared useRefResolver cache. The parent component is expected
 * to have preloaded the ref resource; if it hasn't, we fall back to a
 * "#<id>" badge so the UI never shows the raw "userId: 1".
 */
const { resolveRefDisplay } = useRefResolver()

const refDisplay = computed<RefDisplay>(() => {
  const res = refResource(props.field)
  if (!res) return { label: '—' }
  const labelField = refLabelField(props.field)
  return resolveRefDisplay(res, props.value as string | number | null | undefined, labelField)
})

/** The referenced resource name (string) or undefined when not a ref field. */
const refResourceName = computed(() => refResource(props.field))

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

/* ---------- relative time (for datetime fields) ---------- */
const relativeTime = computed(() => {
  if (!props.value) return ''
  const d = new Date(props.value as string)
  if (Number.isNaN(d.getTime())) return String(props.value)
  const diff = d.getTime() - Date.now()
  const absSec = Math.abs(diff) / 1000
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (absSec < 60) return rtf.format(Math.round(diff / 1000), 'second')
  if (absSec < 3600) return rtf.format(Math.round(diff / 60000), 'minute')
  if (absSec < 86400) return rtf.format(Math.round(diff / 3600000), 'hour')
  if (absSec < 2592000) return rtf.format(Math.round(diff / 86400000), 'day')
  if (absSec < 31536000) return rtf.format(Math.round(diff / 2592000000), 'month')
  return rtf.format(Math.round(diff / 31536000000), 'year')
})

const fullDate = computed(() => {
  if (!props.value) return ''
  const d = new Date(props.value as string)
  if (Number.isNaN(d.getTime())) return String(props.value)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
})

/* ---------- badge ---------- */
/**
 * Map a spec color value (hex string or bare token) to a DaisyUI badge
 * color class. The spec stores colors as hex (e.g. "#22c55e") which are
 * NOT valid CSS classes, so we translate them to the matching DaisyUI
 * token. Bare token names ("success", "warning", …) pass through.
 */
const HEX_TO_BADGE: Record<string, string> = {
  '#22c55e': 'badge-success',
  '#f59e0b': 'badge-warning',
  '#3b82f6': 'badge-info',
  '#8b5cf6': 'badge-primary',
  '#ef4444': 'badge-error',
  '#6b7280': 'badge-ghost',
  // bare token names
  success: 'badge-success',
  warning: 'badge-warning',
  info: 'badge-info',
  primary: 'badge-primary',
  error: 'badge-error',
  neutral: 'badge-ghost',
  ghost: 'badge-ghost',
}
const badgeClass = computed(() => {
  const colors = ui.value.colors ?? {}
  const key = String(props.value)
  const raw = colors[key]
  if (!raw) return 'badge-ghost'
  return HEX_TO_BADGE[String(raw).toLowerCase()] ?? 'badge-ghost'
})

/** Title-case an enum value for display: "in_progress" → "In Progress",
 *  "done" → "Done". Leaves non-enum values untouched. */
function titleCaseEnum(value: unknown): string {
  const s = String(value ?? '')
  return s
    .split(/[-_ ]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
const badgeText = computed(() => {
  // Only humanize when this is an enum field (the badge display mode is
  // used for enum fields with a colors map).
  if (props.field.enum?.length) return titleCaseEnum(props.value)
  return displayText.value
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
  if (!pattern) {
    // Default: link to the ref resource detail page when this is a ref field.
    const res = refResource(props.field)
    if (res && props.value != null) {
      return `/app/${res}/${props.value}`
    }
    return '#'
  }
  if (!props.row) return '#'
  return pattern.replace(/\{(\w+)\}/g, (_, key: string) =>
    props.row ? String(props.row[key] ?? '') : '',
  )
})

/* ---------- file (icon) ---------- */
function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return '🖼'
  if (['pdf'].includes(ext)) return '📄'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜'
  if (['txt', 'md'].includes(ext)) return '📝'
  return '📎'
}

/* ---------- json pretty-print ---------- */
const isJson = computed(() => props.field.type === 'json')
const jsonDisplay = computed(() => {
  if (props.value === null || props.value === undefined) return ''
  if (typeof props.value === 'string') {
    try {
      return JSON.stringify(JSON.parse(props.value), null, 2)
    } catch {
      return props.value
    }
  }
  try {
    return JSON.stringify(props.value, null, 2)
  } catch {
    return String(props.value)
  }
})
/** True when the json value is empty ("{}" or null/undefined). Used to
 *  render a muted "—" placeholder instead of a literal "{}" block. */
const isEmptyJson = computed(() => {
  if (!isJson.value) return false
  if (props.value === null || props.value === undefined) return true
  if (typeof props.value === 'string') {
    const trimmed = props.value.trim()
    return trimmed === '' || trimmed === '{}' || trimmed === '[]'
  }
  if (typeof props.value === 'object') {
    if (Array.isArray(props.value)) return props.value.length === 0
    return Object.keys(props.value as Record<string, unknown>).length === 0
  }
  return false
})

/* ---------- boolean ---------- */
const isBoolean = computed(() => props.field.type === 'boolean')
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <!-- json: empty → muted placeholder; otherwise pretty-printed -->
    <span
      v-if="isJson && isEmptyJson"
      class="text-base-content/30"
    >—</span>
    <pre
      v-else-if="isJson && jsonDisplay"
      class="text-xs bg-base-200 rounded p-2 overflow-x-auto max-w-md font-mono"
    ><code>{{ jsonDisplay }}</code></pre>

    <!-- boolean: shown as badge (by field type, not display) -->
    <span
      v-else-if="isBoolean"
      class="badge badge-sm"
      :class="value === true || value === 'true' ? 'badge-success' : 'badge-ghost'"
    >
      {{ value === true || value === 'true' ? 'Yes' : 'No' }}
    </span>

    <!-- text -->
    <template v-else-if="display === 'text'">
      <!-- ref field without an explicit display hint: show #ID badge by default
           so the UI never renders the raw "userId: 1" string. -->
      <span
        v-if="refResourceName && value != null && value !== ''"
        class="badge badge-sm badge-ghost font-mono"
        :title="refDisplay.label"
      >#{{ value }}</span>
      <template v-else>{{ displayText }}</template>
    </template>

    <!-- badge -->
    <span
      v-else-if="display === 'badge'"
      class="badge badge-sm"
      :class="badgeClass"
    >
      {{ badgeText }}
    </span>

    <!-- date -->
    <time
      v-else-if="display === 'date' && field.type !== 'datetime'"
      :datetime="String(value)"
      class="text-sm text-base-content"
    >{{ formattedDate }}</time>

    <!-- relative time (datetime fields rendered as "2 hours ago") -->
    <time
      v-else-if="display === 'date' && field.type === 'datetime'"
      :datetime="String(value)"
      :title="fullDate"
      class="text-sm text-base-content/70"
    >{{ relativeTime }}</time>

    <!-- avatar: for ref fields, resolve via the ref cache; for inline
         objects, use the avatarImageField on the same row. -->
    <span
      v-else-if="display === 'avatar' && refResourceName"
      class="inline-flex items-center gap-2"
    >
      <template v-if="value != null && value !== ''">
        <span class="avatar avatar-placeholder">
          <span class="w-7 rounded-full bg-neutral text-neutral-content ring-1 ring-base-300">
            <img
              v-if="refDisplay.avatarUrl"
              :src="refDisplay.avatarUrl"
              :alt="refDisplay.label"
              class="rounded-full"
            >
            <span v-else class="text-xs font-semibold">{{ refDisplay.initials ?? '?' }}</span>
          </span>
        </span>
        <span class="text-sm text-base-content" :title="refDisplay.subLabel">
          {{ refDisplay.label }}
        </span>
      </template>
      <span v-else class="text-sm text-base-content/40">—</span>
    </span>

    <!-- avatar (inline object with avatarImageField on the same row) -->
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

    <!-- ref-avatar: ref field rendered as avatar + label (resolved via cache) -->
    <span v-else-if="display === 'ref-avatar'" class="inline-flex items-center gap-2">
      <template v-if="value != null && value !== ''">
        <span class="avatar avatar-placeholder">
          <span class="w-7 rounded-full bg-neutral text-neutral-content ring-1 ring-base-300">
            <img
              v-if="refDisplay.avatarUrl"
              :src="refDisplay.avatarUrl"
              :alt="refDisplay.label"
              class="rounded-full"
            >
            <span v-else class="text-xs font-semibold">{{ refDisplay.initials ?? '?' }}</span>
          </span>
        </span>
        <span class="text-sm text-base-content" :title="refDisplay.subLabel">
          {{ refDisplay.label }}
        </span>
      </template>
      <span v-else class="text-sm text-base-content/40">—</span>
    </span>

    <!-- ref-link: ref field rendered as a link to the related record -->
    <NuxtLink
      v-else-if="display === 'ref-link' && refResourceName && value != null && value !== ''"
      :to="`/app/${refResourceName}/${value}`"
      class="link link-primary text-sm"
      :title="refDisplay.label"
    >
      {{ refDisplay.label }}
    </NuxtLink>

    <!-- truncate -->
    <span
      v-else-if="display === 'truncate'"
      class="block max-w-md truncate"
      :title="displayText"
    >{{ truncatedText }}</span>

    <!-- file icon -->
    <span v-else-if="display === 'icon'" class="inline-flex items-center gap-1.5">
      <span class="text-base" aria-hidden="true">{{ fileIcon(displayText) }}</span>
      <span class="text-sm">{{ displayText }}</span>
    </span>

    <!-- link -->
    <NuxtLink
      v-else-if="display === 'link'"
      :to="linkHref"
      class="link link-primary text-sm"
    >{{ displayText }}</NuxtLink>

    <!-- fallback -->
    <template v-else>{{ displayText }}</template>
  </span>
</template>