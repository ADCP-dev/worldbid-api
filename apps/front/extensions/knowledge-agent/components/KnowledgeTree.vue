<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Note } from '../composables/useKnowledge';

const props = defineProps<{
  notes: Note[];
  selectedId?: string | null;
}>();

const emit = defineEmits<{
  select: [note: Note];
}>();

interface TreeNode {
  label: string;
  path: string;
  notes: Note[];
  children: Map<string, TreeNode>;
}

const expanded = ref<Set<string>>(new Set());

const tree = computed<TreeNode>(() => {
  const root: TreeNode = {
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

function isExpanded(path: string) {
  return expanded.value.has(path);
}

const sortedChildren = (node: TreeNode): TreeNode[] =>
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
      <li v-for="node in sortedChildren(tree)" :key="node.path">
        <details :open="isExpanded(node.path)" @toggle="toggle(node.path)">
          <summary class="font-medium cursor-pointer">
            {{ node.label }}
            <span class="badge badge-xs badge-ghost ml-1">{{ node.notes.length }}</span>
          </summary>
          <ul>
            <li v-for="child in sortedChildren(node)" :key="child.path">
              <details :open="isExpanded(child.path)" @toggle="toggle(child.path)">
                <summary class="cursor-pointer">{{ child.label }}</summary>
                <ul>
                  <li v-for="n in child.notes" :key="n.id">
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
    </ul>
  </div>
</template>