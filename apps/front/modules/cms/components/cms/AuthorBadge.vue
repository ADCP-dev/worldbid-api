<script setup lang="ts">
interface Props {
  authorName?: string
  authorEmail?: string
  createdAt?: string
}

const props = defineProps<Props>()

const initials = computed(() => {
  if (props.authorName) {
    return props.authorName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  if (props.authorEmail) {
    return props.authorEmail[0].toUpperCase()
  }
  return '?'
})

const displayName = computed(() => {
  return props.authorName || props.authorEmail || '—'
})

const formattedDate = computed(() => {
  if (!props.createdAt) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(props.createdAt))
  } catch {
    return props.createdAt
  }
})
</script>

<template>
    <div class="flex items-center gap-2" :class="{ 'tooltip tooltip-right': !!formattedDate }" :data-tip="formattedDate || undefined">
    <div class="avatar placeholder">
      <div class="bg-neutral text-neutral-content rounded-full w-7 h-7 text-xs font-medium flex items-center justify-center">
        {{ initials }}
      </div>
    </div>
    <span class="text-sm text-base-content/80 truncate max-w-[120px]">
      {{ displayName }}
    </span>
  </div>
</template>
