<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Note } from '../composables/useKnowledge';
import TreeNode from './TreeNode.vue';

const props = defineProps<{
  notes: Note[];
  selectedId?: string | null;
}>();

const emit = defineEmits<{
  select: [note: Note];
}>();

interface TreeNodeData {
  label: string;
  path: string;
  notes: Note[];
  children: Map<string, TreeNodeData>;
}

const expanded = ref<Set<string>>(new Set());

const tree = computed<TreeNodeData>(() => {
  const root: TreeNodeData = {
    label: 'root',
    path: '',
    notes: [],
    children: new Map(),
  };

  for (const note of props.notes) {
    const segments = (note.categoryPath ?? 'uncategorized').split('.');
    let current = root;
    let pathAcc = '';

    for (const seg of segments) {
      pathAcc = pathAcc ? `${pathAcc}.${seg}` : seg;
      if (!current.children.has(seg)) {
        current.children.set(seg, {
          label: seg,
          path: pathAcc,
          notes: [],
          children: new Map(),
        });
      }
      current = current.children.get(seg)!;
    }
    current.notes.push(note);
  }

  return root;
});

function toggle(path: string) {
  if (expanded.value.has(path)) {
    expanded.value.delete(path);
  } else {
    expanded.value.add(path);
  }
}

const sortedChildren = (node: TreeNodeData): TreeNodeData[] =>
  [...node.children.values()].sort((a, b) => a.label.localeCompare(b.label));

// Auto-expand top-level
watch(
  tree,
  (t) => {
    for (const child of t.children.values()) {
      if (!expanded.value.has(child.path)) {
        expanded.value.add(child.path);
      }
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="h-full overflow-auto p-2 text-sm">
    <div v-if="notes.length === 0" class="text-base-content/50 italic p-4">
      No notes yet
    </div>
    <ul v-else class="menu menu-xs w-full">
      <TreeNode
        v-for="node in sortedChildren(tree)"
        :key="node.path"
        :node="node"
        :selected-id="selectedId"
        :expanded="expanded"
        @select="emit('select', $event)"
        @toggle="toggle($event)"
      />
    </ul>
  </div>
</template>