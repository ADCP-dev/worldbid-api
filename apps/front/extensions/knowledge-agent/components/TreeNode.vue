<script setup lang="ts">
import type { Note } from '../composables/useKnowledge';

interface TreeNode {
  label: string;
  path: string;
  notes: Note[];
  children: Map<string, TreeNode>;
}

defineProps<{
  node: TreeNode;
  selectedId?: string | null;
  expanded: Set<string>;
}>();

const emit = defineEmits<{
  select: [note: Note];
  toggle: [path: string];
}>();

function sortedChildren(node: TreeNode): TreeNode[] {
  return [...node.children.values()].sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}
</script>

<template>
  <li>
    <details :open="expanded.has(node.path)" @toggle.prevent="emit('toggle', node.path)">
      <summary class="font-medium cursor-pointer">
        {{ node.label }}
        <span class="badge badge-xs badge-ghost ml-1">{{ node.notes.length }}</span>
      </summary>
      <ul>
        <TreeNode
          v-for="child in sortedChildren(node)"
          :key="child.path"
          :node="child"
          :selected-id="selectedId"
          :expanded="expanded"
          @select="emit('select', $event)"
          @toggle="emit('toggle', $event)"
        />
        <li v-for="n in node.notes" :key="n.id">
          <a
            :class="{ active: n.id === selectedId }"
            class="cursor-pointer truncate"
            @click="emit('select', n)"
          >
            {{ n.title }}
          </a>
        </li>
      </ul>
    </details>
  </li>
</template>