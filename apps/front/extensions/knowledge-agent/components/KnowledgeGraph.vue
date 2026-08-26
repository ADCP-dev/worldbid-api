<script setup lang="ts">
/**
 * KnowledgeGraph — full-screen d3-force graph viewer.
 *
 * SVG canvas with:
 *  - <defs> filters (glow-hover, glow-selected) + radialGradient halo
 *  - edges <g> (lines, opacity by highlight)
 *  - nodes <g> (circle + label), radius/color by degree, hover + selected halo
 *  - drag handlers (fix fx/fy), click to select, hover to highlight neighbors
 *
 * Overlays (absolutely positioned over the SVG):
 *  - top-left: toolbar (reheat, add note, zoom in/out/reset) + search + filter
 *  - top-right: stats badge (notes + edges count)
 *  - bottom-left: legend (hub / linked / isolated)
 *  - bottom: status hints (drag, scroll, click)
 *  - right side: backlinks panel (translate-x when a node is selected)
 */
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RefreshCw,
  FilePlus,
  Search,
  X,
  Focus,
  Network,
  Tag,
  Link,
} from 'lucide-vue-next';
import { useKnowledgeGraph, type SimNode } from '../composables/useKnowledgeGraph';

const emit = defineEmits<{
  select: [id: string];
  new: [];
}>();

// Viewport size — observed via ResizeObserver so the SVG always fills its
// container and the simulation forces center on the right point.
const containerRef = ref<HTMLDivElement | null>(null);
const width = ref(800);
const height = ref(600);

const {
  nodes,
  edges,
  transform,
  hoveredNodeId,
  selectedNodeId,
  selectedNode,
  selectedNodeLinks,
  neighborSet,
  categories,
  tags,
  stats,
  loading,
  error,
  filterCategory,
  searchQuery,
  load,
  bindSvg,
  reheatSimulation,
  resetZoom,
  zoomIn,
  zoomOut,
  makeDragHandlers,
  selectNode,
  hoverNode,
  clearSelection,
  destroy,
} = useKnowledgeGraph({ width, height });

const svgRef = ref<SVGSVGElement | null>(null);

// Drag handlers are stable for the lifetime of the composable.
const drag = makeDragHandlers();

// ---- Highlight helpers ---------------------------------------------------

const focusId = computed(() => hoveredNodeId.value ?? selectedNodeId.value);

function edgeOpacity(edgeSource: string, edgeTarget: string): number {
  const f = focusId.value;
  if (!f) return 0.45;
  const touches = edgeSource === f || edgeTarget === f;
  return touches ? 0.85 : 0.12;
}

function nodeOpacity(nodeId: string): number {
  const f = focusId.value;
  if (!f) return 1;
  return neighborSet.value.has(nodeId) ? 1 : 0.25;
}

function labelFill(nodeId: string): string {
  const f = focusId.value;
  if (!f) return '#e5e7eb';
  return neighborSet.value.has(nodeId) ? '#f5f3ff' : '#4b5563';
}

// Node radius/color come from the composable (degree-based).
function radiusOf(node: SimNode): number {
  return 5 + Math.min(node.degree * 1.8, 14);
}

function colorOf(node: SimNode): string {
  if (node.degree === 0) return '#6b7280';
  if (node.degree >= 4) return '#c084fc';
  return '#a78bfa';
}

function isHub(node: SimNode): boolean {
  return node.degree >= 4;
}

// Edge source/target may be string (before sim resolves) or SimNode (after).
function edgeSourceId(e: { source: string | SimNode }): string {
  return typeof e.source === 'object' ? e.source.id : (e.source as string);
}
function edgeTargetId(e: { target: string | SimNode }): string {
  return typeof e.target === 'object' ? e.target.id : (e.target as string);
}

// ---- Event wiring ---------------------------------------------------------

function onNodeMouseEnter(node: SimNode) {
  hoverNode(node.id);
}
function onNodeMouseLeave() {
  hoverNode(null);
}
function onNodeClick(node: SimNode, ev: MouseEvent) {
  ev.stopPropagation();
  selectNode(node.id);
}
function onBackgroundClick() {
  clearSelection();
}

// Native drag handlers — attached to each node <g>. We convert pointer events
// so drag works for both mouse and touch (d3-zoom handles wheel/pan).
function onNodeMouseDown(node: SimNode, ev: MouseEvent) {
  ev.stopPropagation();
  drag.onDragStart(node, ev);

  const move = (e: MouseEvent) => drag.onDragMove(node, e);
  const up = () => {
    drag.onDragEnd(node);
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

// ---- Filter + search -----------------------------------------------------

const filterTag = ref<string | null>(null);

async function applyFilter() {
  await load({
    categoryPath: filterCategory.value ?? undefined,
    tag: filterTag.value ?? undefined,
  });
}

watch(filterCategory, () => {
  void applyFilter();
});
watch(filterTag, () => {
  void applyFilter();
});

// Client-side search highlight: nodes whose label matches the query are
// highlighted; others dim. We don't refetch — the backend already returned
// the user's full graph (or the filtered subset).
const searchMatches = computed<Set<string>>(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return new Set<string>();
  const set = new Set<string>();
  for (const n of nodes.value) {
    if (n.label.toLowerCase().includes(q)) set.add(n.id);
  }
  return set;
});

function isSearchHit(nodeId: string): boolean {
  if (searchMatches.value.size === 0) return false;
  return searchMatches.value.has(nodeId);
}

// ---- Backlinks panel helpers --------------------------------------------

function otherNodeLabel(otherId: string): string {
  const n = nodes.value.find((x) => x.id === otherId);
  return n?.label ?? otherId;
}

// ---- Lifecycle -----------------------------------------------------------

let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  if (containerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        width.value = entry.contentRect.width;
        height.value = entry.contentRect.height;
      }
    });
    resizeObserver.observe(containerRef.value);
  }

  // Wait one tick so the SVG ref is mounted.
  await Promise.resolve();
  if (svgRef.value) bindSvg(svgRef.value);

  await load();
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  destroy();
});

function goToAddNote() {
  emit('new');
}

function goToNote(id: string) {
  emit('select', id);
}

// Focalize on the selected node: translate the zoom so the node is centered.
function focalizeSelected() {
  const node = selectedNode.value;
  if (!node || !node.x || !node.y) return;
  // We cannot easily call d3-zoom.translateTo from outside the composable
  // without the selection; instead we reset and rely on the composable's
  // resetZoom. Full focalization is a v2 enhancement.
  resetZoom();
}
</script>

<template>
  <div
    ref="containerRef"
    class="relative w-full h-full overflow-hidden bg-[#1e1e2e] select-none"
    style="color: #e5e7eb"
  >
    <!-- Loading / error states -->
    <div
      v-if="loading && nodes.length === 0"
      class="absolute inset-0 flex items-center justify-center z-20"
    >
      <span class="loading loading-spinner loading-lg text-violet-400" />
    </div>
    <div
      v-else-if="error"
      class="absolute top-4 left-1/2 -translate-x-1/2 z-20"
    >
      <div class="alert alert-error shadow-lg">
        <span>{{ error }}</span>
      </div>
    </div>

    <!-- SVG canvas -->
    <svg
      ref="svgRef"
      class="w-full h-full block"
      :viewBox="`0 0 ${width} ${height}`"
      @click="onBackgroundClick"
    >
      <defs>
        <!-- Glow on hover -->
        <filter id="glow-hover" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <!-- Stronger glow for selected node -->
        <filter id="glow-selected" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <!-- Radial gradient halo behind selected node -->
        <radialGradient id="selectedHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#c084fc" stop-opacity="0.45" />
          <stop offset="60%" stop-color="#c084fc" stop-opacity="0.12" />
          <stop offset="100%" stop-color="#c084fc" stop-opacity="0" />
        </radialGradient>
      </defs>

      <!-- Zoom/pan wrapper -->
      <g :transform="`translate(${transform.x}, ${transform.y}) scale(${transform.k})`">
        <!-- Edges -->
        <g class="edges" stroke="#7c3aed" stroke-width="1.5">
          <line
            v-for="(e, i) in edges"
            :key="`e-${i}`"
            :x1="(typeof e.source === 'object' ? e.source.x : 0) ?? 0"
            :y1="(typeof e.source === 'object' ? e.source.y : 0) ?? 0"
            :x2="(typeof e.target === 'object' ? e.target.x : 0) ?? 0"
            :y2="(typeof e.target === 'object' ? e.target.y : 0) ?? 0"
            :stroke-opacity="edgeOpacity(edgeSourceId(e), edgeTargetId(e))"
          />
        </g>

        <!-- Nodes -->
        <g class="nodes">
          <g
            v-for="node in nodes"
            :key="node.id"
            :transform="`translate(${node.x ?? 0}, ${node.y ?? 0})`"
            :opacity="nodeOpacity(node.id)"
            class="cursor-pointer"
            @mouseenter="onNodeMouseEnter(node)"
            @mouseleave="onNodeMouseLeave"
            @click="onNodeClick(node, $event)"
            @mousedown="onNodeMouseDown(node, $event)"
          >
            <!-- Selected halo (behind circle) -->
            <circle
              v-if="selectedNodeId === node.id"
              r="32"
              fill="url(#selectedHalo)"
            />

            <!-- Search-hit ring -->
            <circle
              v-if="isSearchHit(node.id)"
              :r="radiusOf(node) + 6"
              fill="none"
              stroke="#facc15"
              stroke-width="2"
              stroke-dasharray="3 3"
            />

            <!-- Main circle -->
            <circle
              :r="radiusOf(node)"
              :fill="colorOf(node)"
              :stroke="selectedNodeId === node.id ? '#f5f3ff' : hoveredNodeId === node.id ? '#ddd6fe' : 'transparent'"
              :stroke-width="selectedNodeId === node.id ? 2 : 1"
              :filter="hoveredNodeId === node.id ? 'url(#glow-hover)' : selectedNodeId === node.id ? 'url(#glow-selected)' : undefined"
            />

            <!-- White center dot for hubs -->
            <circle
              v-if="isHub(node)"
              r="2.5"
              fill="#ffffff"
            />

            <!-- Label -->
            <text
              :fill="labelFill(node.id)"
              font-size="11"
              text-anchor="middle"
              :y="radiusOf(node) + 14"
              class="pointer-events-none"
              style="font-family: ui-sans-serif, system-ui, sans-serif"
            >
              {{ node.label }}
            </text>
          </g>
        </g>
      </g>
    </svg>

    <!-- Empty state overlay -->
    <div
      v-if="!loading && nodes.length === 0 && !error"
      class="absolute inset-0 flex flex-col items-center justify-center z-10 text-gray-400"
    >
      <Network class="w-12 h-12 mb-3 opacity-50" />
      <p class="text-lg mb-1">{{ $t('ext.ka.graph.emptyTitle') }}</p>
      <p class="text-sm opacity-60 mb-4">{{ $t('ext.ka.graph.emptySubtitle') }}</p>
      <button class="btn btn-sm btn-primary" @click="goToAddNote">
        <FilePlus class="w-4 h-4" />
        {{ $t('ext.ka.notes.create') }}
      </button>
    </div>

    <!-- Top-left floating toolbar -->
    <div class="absolute top-4 left-4 z-10 flex flex-col gap-2">
      <div class="flex gap-1">
        <button
          class="btn btn-sm btn-ghost bg-base-100/10 hover:bg-base-100/20 text-gray-200 border border-white/10"
          title="Re-distribute"
          @click="reheatSimulation"
        >
          <RefreshCw class="w-4 h-4" />
        </button>
        <button
          class="btn btn-sm btn-ghost bg-base-100/10 hover:bg-base-100/20 text-gray-200 border border-white/10"
          title="Add note"
          @click="goToAddNote"
        >
          <FilePlus class="w-4 h-4" />
        </button>
        <div class="divider divider-horizontal mx-1"/>
        <button
          class="btn btn-sm btn-ghost bg-base-100/10 hover:bg-base-100/20 text-gray-200 border border-white/10"
          title="Zoom in"
          @click="zoomIn"
        >
          <ZoomIn class="w-4 h-4" />
        </button>
        <button
          class="btn btn-sm btn-ghost bg-base-100/10 hover:bg-base-100/20 text-gray-200 border border-white/10"
          title="Zoom out"
          @click="zoomOut"
        >
          <ZoomOut class="w-4 h-4" />
        </button>
        <button
          class="btn btn-sm btn-ghost bg-base-100/10 hover:bg-base-100/20 text-gray-200 border border-white/10"
          title="Reset zoom"
          @click="resetZoom"
        >
          <Maximize class="w-4 h-4" />
        </button>
      </div>

      <!-- Search + filters -->
      <div class="flex gap-2 items-center">
        <div class="relative">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search notes..."
            class="input input-sm w-48 pl-8 bg-base-100/10 text-gray-200 border border-white/10 placeholder-gray-500"
          >
        </div>
        <select
          v-model="filterCategory"
          class="select select-sm bg-base-100/10 text-gray-200 border border-white/10"
        >
          <option :value="null" class="bg-[#1e1e2e]">All categories</option>
          <option
            v-for="c in categories"
            :key="c"
            :value="c"
            class="bg-[#1e1e2e]"
          >
            {{ c }}
          </option>
        </select>
        <select
          v-model="filterTag"
          class="select select-sm bg-base-100/10 text-gray-200 border border-white/10"
        >
          <option :value="null" class="bg-[#1e1e2e]">All tags</option>
          <option
            v-for="t in tags"
            :key="t"
            :value="t"
            class="bg-[#1e1e2e]"
          >
            {{ t }}
          </option>
        </select>
      </div>
    </div>

    <!-- Top-right stats badge -->
    <div class="absolute top-4 right-4 z-10">
      <div class="badge badge-lg gap-2 bg-base-100/10 text-gray-200 border border-white/10 px-3 py-3">
        <span class="text-violet-300 font-semibold">{{ stats.nodes }}</span>
        <span class="text-gray-400 text-xs">notes</span>
        <span class="text-gray-600">·</span>
        <span class="text-violet-300 font-semibold">{{ stats.edges }}</span>
        <span class="text-gray-400 text-xs">links</span>
      </div>
    </div>

    <!-- Bottom-left legend -->
    <div class="absolute bottom-4 left-4 z-10">
      <div class="bg-base-100/10 border border-white/10 rounded-lg p-3 text-xs text-gray-300 space-y-1.5">
        <div class="flex items-center gap-2">
          <span class="inline-block w-3 h-3 rounded-full bg-[#c084fc]"/>
          <span>Hub central (≥4 conexiones)</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-block w-3 h-3 rounded-full bg-[#a78bfa]"/>
          <span>Nota vinculada (1-3)</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="inline-block w-3 h-3 rounded-full bg-[#6b7280]"/>
          <span>Nota aislada (0)</span>
        </div>
      </div>
    </div>

    <!-- Bottom status bar (hints) -->
    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <div class="bg-base-100/10 border border-white/10 rounded-full px-4 py-1.5 text-xs text-gray-400 flex gap-4">
        <span><kbd class="kbd kbd-xs">Arrastrar</kbd> mover nodo</span>
        <span><kbd class="kbd kbd-xs">Scroll</kbd> zoom</span>
        <span><kbd class="kbd kbd-xs">Click</kbd> seleccionar</span>
      </div>
    </div>

    <!-- Right side panel: backlinks -->
    <transition name="slide-panel">
      <aside
        v-if="selectedNode"
        class="absolute top-0 right-0 bottom-0 w-80 sm:w-96 z-20 bg-[#262637] border-l border-white/10 shadow-2xl flex flex-col"
        @click.stop
      >
        <!-- Header -->
        <div class="p-4 border-b border-white/10 flex items-start justify-between gap-2">
          <div class="flex items-start gap-2 min-w-0">
            <FilePlus class="w-4 h-4 mt-0.5 text-violet-400 shrink-0" />
            <div class="min-w-0">
              <h3 class="font-semibold text-gray-100 truncate">{{ selectedNode.label }}.md</h3>
              <div class="flex flex-wrap gap-1 mt-1.5">
                <span
                  v-for="t in selectedNode.tags"
                  :key="t"
                  class="badge badge-xs badge-violet bg-violet-500/20 text-violet-200 border-violet-500/30"
                >
                  <Tag class="w-2.5 h-2.5 mr-0.5" />{{ t }}
                </span>
              </div>
              <div v-if="selectedNode.categoryPath" class="mt-1.5">
                <span class="badge badge-xs badge-ghost bg-white/5 text-gray-300 border-white/10">
                  {{ selectedNode.categoryPath }}
                </span>
              </div>
            </div>
          </div>
          <button
            class="btn btn-ghost btn-xs text-gray-400 hover:text-gray-200"
            @click="clearSelection"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Degree counter -->
        <div class="px-4 py-2 border-b border-white/10 text-xs text-gray-400">
          <span class="text-violet-300 font-semibold">{{ selectedNode.degree }}</span>
          {{ $t('ext.ka.graph.connections') }}
        </div>

        <!-- Body: backlinks -->
        <div class="flex-1 overflow-auto p-4 space-y-2">
          <h4 class="text-xs uppercase tracking-wider text-gray-500 mb-2">
            {{ $t('ext.ka.graph.backlinks') }}
          </h4>
          <div v-if="selectedNodeLinks.length === 0" class="text-sm text-gray-500 italic">
            {{ $t('ext.ka.graph.emptyBacklinks') }}
          </div>
          <button
            v-for="link in selectedNodeLinks"
            :key="link.otherId"
            class="w-full text-left p-2 rounded-md bg-white/5 hover:bg-violet-500/10 border border-white/5 hover:border-violet-500/30 transition-colors"
            @click="selectNode(link.otherId)"
          >
            <div class="flex items-center gap-2">
              <Link class="w-3 h-3 text-violet-400 shrink-0" />
              <span class="text-sm text-gray-200 truncate">{{ otherNodeLabel(link.otherId) }}</span>
            </div>
          </button>
        </div>

        <!-- Footer -->
        <div class="p-3 border-t border-white/10 flex gap-2">
          <button
            class="btn btn-sm btn-ghost flex-1 text-gray-300 border border-white/10"
            @click="focalizeSelected"
          >
            <Focus class="w-4 h-4" />
            {{ $t('ext.ka.graph.focus') }}
          </button>
          <button
            class="btn btn-sm btn-primary flex-1"
            @click="goToNote(selectedNode.id)"
          >
            {{ $t('ext.ka.graph.openNote') }}
          </button>
        </div>
      </aside>
    </transition>
  </div>
</template>

<style scoped>
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>