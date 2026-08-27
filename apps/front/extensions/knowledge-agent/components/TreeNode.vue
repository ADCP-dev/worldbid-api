<script setup lang="ts">
import { ChevronRight, Folder, FolderOpen, FileText } from 'lucide-vue-next';
import type { Note } from '../composables/useKnowledge';

interface TreeNodeData {
  label: string;
  path: string;
  notes: Note[];
  children: Map<string, TreeNodeData>;
}

defineProps<{
  node: TreeNodeData;
  selectedId?: string | null;
  expanded: Set<string>;
}>();

const emit = defineEmits<{
  select: [note: Note];
  toggle: [path: string];
}>();

function sortedChildren(node: TreeNodeData): TreeNodeData[] {
  return [...node.children.values()].sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

function countAll(node: TreeNodeData): number {
  let n = node.notes.length;
  for (const child of node.children.values()) {
    n += countAll(child);
  }
  return n;
}
</script>

<template>
  <li>
    <!-- Folder row -->
    <button
      type="button"
      class="ka-tree-folder flex items-center gap-1.5 w-full px-2 py-1 rounded-md hover:bg-base-300 text-left"
      :aria-expanded="expanded.has(node.path)"
      @click="emit('toggle', node.path)"
    >
      <ChevronRight
        :size="13"
        class="shrink-0 text-base-content/50 transition-transform duration-150"
        :class="{ 'rotate-90': expanded.has(node.path) }"
      />
      <FolderOpen v-if="expanded.has(node.path)" :size="14" class="shrink-0 text-warning/90" />
      <Folder v-else :size="14" class="shrink-0 text-warning" />
      <span class="truncate font-medium text-sm">{{ node.label }}</span>
      <span class="badge badge-xs badge-ghost ml-auto shrink-0">{{ countAll(node) }}</span>
    </button>

    <!-- Children (folders + notes) -->
    <ul v-if="expanded.has(node.path)" class="pl-4 border-l border-base-300/60 ml-2 mt-0.5 space-y-0.5">
      <TreeNode
        v-for="child in sortedChildren(node)"
        :key="child.path"
        :node="child"
        :selected-id="selectedId"
        :expanded="expanded"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
      />

      <!-- Leaf notes of this folder -->
      <li v-for="note in node.notes" :key="note.id">
        <button
          type="button"
          class="ka-tree-note flex items-center gap-1.5 w-full px-2 py-1 rounded-md text-left truncate"
          :class="note.id === selectedId ? 'bg-primary/10 text-primary' : 'hover:bg-base-300 text-base-content/90'"
          @click="emit('select', note)"
        >
          <FileText
            :size="13"
            class="shrink-0"
            :class="note.id === selectedId ? 'text-primary' : 'text-base-content/40'"
          />
          <span class="truncate text-sm">{{ note.title }}</span>
        </button>
      </li>
    </ul>
  </li>
</template>
