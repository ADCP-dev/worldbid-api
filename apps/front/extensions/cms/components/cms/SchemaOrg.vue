<script setup lang="ts">
/**
 * SchemaOrg Component
 * Renders JSON-LD structured data scripts for SEO
 *
 * Usage:
 * ```vue
 * <SchemaOrg :schemas="schemas" />
 *
 * <!-- Or use with composable -->
 * <SchemaOrg :schemas="useSchema().schemas.value" />
 * ```
 */

import type { JsonLdSchema } from '@cms/types/json-ld';

interface Props {
  schemas?: JsonLdSchema[];
}

const props = withDefaults(defineProps<Props>(), {
  schemas: () => [],
});

// Render nothing if no schemas provided
const hasSchemas = computed(() => {
  return Array.isArray(props.schemas) && props.schemas.length > 0;
});

// Get schemas as JSON string
const schemasJson = computed(() => {
  if (!hasSchemas.value) return '';
  return JSON.stringify(props.schemas);
});

// Inject JSON-LD script tags via useHead
useHead({
  script: hasSchemas.value
    ? props.schemas.map((schema) => ({
        type: 'application/ld+json',
        children: JSON.stringify(schema),
      }))
    : [],
});
</script>

<template>
  <!-- Component is head-only - no visible render needed -->
  <!-- JSON-LD is injected via useHead() -->
</template>