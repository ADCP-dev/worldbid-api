<script setup lang="ts">
import { ref, computed } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import {
  GripVertical,
  ChevronRight,
  ChevronDown,
  FileText,
  Globe,
} from "lucide-vue-next";

interface PageItem {
  id: string;
  slug: string;
  title: string;
  parentId: string | null;
  children?: PageItem[];
  isPublished?: boolean;
}

interface Props {
  pages: PageItem[];
  onReorder: (pageIds: string[], parentId: string | null) => void;
}

const props = defineProps<Props>();

// Group pages by parent
const rootPages = computed(() => {
  return props.pages.filter((p) => !p.parentId);
});

const getChildren = (parentId: string): PageItem[] => {
  return props.pages.filter((p) => p.parentId === parentId);
};

// Track expanded state
const expandedParents = ref<Set<string>>(new Set());

const toggleExpanded = (pageId: string) => {
  if (expandedParents.value.has(pageId)) {
    expandedParents.value.delete(pageId);
  } else {
    expandedParents.value.add(pageId);
  }
};

const isExpanded = (pageId: string) => expandedParents.value.has(pageId);

// Build sortable list - flattens hierarchy for sortable implementation
// but maintains visual hierarchy
interface FlatPage {
  id: string;
  page: PageItem;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

const flatPages = computed<FlatPage[]>(() => {
  const result: FlatPage[] = [];

  const addPages = (pages: PageItem[], depth: number) => {
    for (const page of pages) {
      const children = getChildren(page.id);
      const hasChildren = children.length > 0;
      result.push({
        id: page.id,
        page,
        depth,
        hasChildren,
        isExpanded: isExpanded(page.id),
      });
      if (hasChildren && isExpanded(page.id)) {
        addPages(children, depth + 1);
      }
    }
  };

  addPages(rootPages.value, 0);
  return result;
});

// Local editable copy of the flat list — VueDraggable mutates this via v-model
const sortableList = ref<FlatPage[]>([...flatPages.value]);

// Keep local list in sync when the prop-driven flat view changes
watch(
  flatPages,
  (val) => {
    sortableList.value = [...val];
  },
  { immediate: true, deep: true },
);

// VueDraggable @change handler — shape: { added?, removed?, moved? }
function onChange(_event: { added?: unknown; removed?: unknown; moved?: unknown }) {
  const orderedIds = sortableList.value.map((fp) => fp.id);
  // Flat-list drag: root-level reorder → parentId null
  props.onReorder(orderedIds, null);
}
</script>

<template>
  <div class="space-y-1">
    <VueDraggable
      v-model="sortableList"
      :animation="150"
      :handle="'.drag-handle'"
      ghost-class="opacity-40"
      item-key="id"
      @change="onChange"
    >
      <div
        v-for="flat in sortableList"
        :key="flat.id"
        class="flex items-center gap-2 p-2 rounded-lg hover:bg-base-200 transition-colors group"
        :style="{ paddingLeft: `${flat.depth * 1.5 + 0.5}rem` }"
      >
        <!-- Expand/Collapse toggle -->
        <button
          v-if="flat.hasChildren"
          type="button"
          class="btn btn-ghost btn-xs btn-square"
          @click="toggleExpanded(flat.id)"
        >
          <component
            :is="flat.isExpanded ? ChevronDown : ChevronRight"
            class="w-4 h-4"
          />
        </button>
        <div v-else class="w-6"/>

        <!-- Drag handle -->
        <div class="drag-handle cursor-grab active:cursor-grabbing text-base-content/40">
          <GripVertical class="w-4 h-4" />
        </div>

        <!-- Page icon -->
        <component
          :is="flat.page.isPublished ? FileText : Globe"
          class="w-4 h-4 text-base-content/60"
        />

        <!-- Page info -->
        <div class="flex-1 min-w-0">
          <span class="font-medium truncate">{{ flat.page.title }}</span>
          <span class="text-sm text-base-content/60 ml-2"
            >/{{ flat.page.slug }})</span
          >
        </div>

        <!-- Status badge -->
        <div
          class="badge badge-sm"
          :class="flat.page.isPublished ? 'badge-success' : 'badge-warning'"
        >
          {{ flat.page.isPublished ? "Published" : "Draft" }}
        </div>
      </div>
    </VueDraggable>

    <!-- Empty state -->
    <div
      v-if="sortableList.length === 0"
      class="text-center py-8 text-base-content/60"
    >
      <FileText class="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>No pages found</p>
    </div>
  </div>
</template>
