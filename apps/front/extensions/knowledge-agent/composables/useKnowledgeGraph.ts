/**
 * useKnowledgeGraph — Vue 3 port of the user's React d3-force demo.
 *
 * Responsibilities:
 *  - fetch graph data (nodes + edges) from `/ka/graph`
 *  - run a d3-force simulation (link, charge, collide, center, x/y)
 *  - expose reactive `nodes`/`edges` updated on every tick
 *  - manage d3-zoom (pan + scaleExtent [0.2, 4]) with reactive `transform`
 *  - drag handler (fix node fx/fy while dragging, release on mouseup)
 *  - highlight state: hoveredNodeId, selectedNodeId + neighborSet
 *  - degree-based radius and color helpers
 *
 * The SVG element is owned by the caller (KnowledgeGraph.vue); the composable
 * attaches zoom + drag behaviors to it via `bindSvg(svgEl)`.
 */
import { computed, ref, shallowRef, type Ref } from 'vue';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceCenter,
  forceX,
  forceY,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type D3ZoomEvent } from 'd3-zoom';
import { fetchGraph } from './useKnowledge';
import type { GraphData, GraphEdge, GraphNode } from './useKnowledge';

/** Mutable simulation node — x/y/vx/vy are added by d3-force at runtime. */
export interface SimNode extends SimulationNodeDatum {
  id: string;
  label: string;
  tags: string[];
  categoryPath: string | null;
  degree: number;
}

export interface SimEdge extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
}

export interface GraphTransform {
  x: number;
  y: number;
  k: number;
}

const ISOLATED_COLOR = '#6b7280'; // gray-500 — degree 0
const LINKED_COLOR = '#a78bfa'; // violet-400 — 1..3
const HUB_COLOR = '#c084fc'; // purple-400 — >=4

export function useKnowledgeGraph(options?: {
  width?: Ref<number>;
  height?: Ref<number>;
}) {
  // fetchGraph is called imperatively in load() below — d3 manages its own state.

  // Reactive state
  const nodes = ref<SimNode[]>([]);
  const edges = ref<SimEdge[]>([]);
  const transform = ref<GraphTransform>({ x: 0, y: 0, k: 1 });
  const hoveredNodeId = ref<string | null>(null);
  const selectedNodeId = ref<string | null>(null);
  const searchQuery = ref('');
  const filterCategory = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // d3 internals — shallowRef to avoid deep reactivity on the simulation
  const simulation = shallowRef<Simulation<SimNode, SimEdge> | null>(null);
  const zoomBehavior = shallowRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const svgSelection = shallowRef<ReturnType<typeof select<SVGSVGElement>> | null>(null);

  // Dimension accessors — caller passes reactive width/height (viewport size).
  const widthRef = options?.width ?? ref(800);
  const heightRef = options?.height ?? ref(600);

  /**
   * Degree map for O(1) radius/color lookups during render.
   * Recomputed when nodes change (after fetch or filter).
   */
  const nodeDegreeMap = computed<Map<string, number>>(() => {
    const m = new Map<string, number>();
    for (const n of nodes.value) m.set(n.id, n.degree);
    return m;
  });

  /**
   * Set of node ids that are neighbors of the hovered or selected node.
   * Used to highlight connected edges + nodes and dim the rest.
   */
  const neighborSet = computed<Set<string>>(() => {
    const focus = hoveredNodeId.value ?? selectedNodeId.value;
    if (!focus) return new Set<string>();
    const set = new Set<string>([focus]);
    for (const e of edges.value) {
      const s = typeof e.source === 'object' ? e.source.id : e.source;
      const t = typeof e.target === 'object' ? e.target.id : e.target;
      if (s === focus) set.add(t);
      if (t === focus) set.add(s);
    }
    return set;
  });

  /** Radius scaled by degree: 5 + min(degree * 1.8, 14). Isolated nodes stay small. */
  function getNodeRadius(nodeId: string): number {
    const degree = nodeDegreeMap.value.get(nodeId) ?? 0;
    return 5 + Math.min(degree * 1.8, 14);
  }

  /** Degree 0 = gray, >=4 = purple (hub), else light violet. */
  function getNodeColor(node: SimNode): string {
    if (node.degree === 0) return ISOLATED_COLOR;
    if (node.degree >= 4) return HUB_COLOR;
    return LINKED_COLOR;
  }

  function getNodeColorById(nodeId: string): string {
    const deg = nodeDegreeMap.value.get(nodeId) ?? 0;
    if (deg === 0) return ISOLATED_COLOR;
    if (deg >= 4) return HUB_COLOR;
    return LINKED_COLOR;
  }

  /** Build and start the simulation for the current nodes/edges. */
  function buildSimulation(): void {
    const w = widthRef.value;
    const h = heightRef.value;

    // Stop any previous simulation.
    simulation.value?.stop();

    const sim = forceSimulation<SimNode>(nodes.value as SimNode[])
      .force(
        'link',
        forceLink<SimNode, SimEdge>(edges.value as SimEdge[])
          .id((d) => d.id)
          .distance(85)
          .strength(0.12),
      )
      .force('charge', forceManyBody().strength(-320))
      .force(
        'collide',
        forceCollide<SimNode>()
          .radius((d) => getNodeRadius(d.id) + 22)
          .iterations(2),
      )
      .force('x', forceX<SimNode>(w / 2).strength(0.045))
      .force('y', forceY<SimNode>(h / 2).strength(0.045))
      .force('center', forceCenter<SimNode>(w / 2, h / 2))
      .alphaDecay(0.02);

    sim.on('tick', () => {
      // Trigger Vue reactivity by replacing the array reference on each tick.
      // shallowRef nodes would not deep-track; using ref + new array is the
      // cheapest way to make the template re-render positions.
      nodes.value = [...sim.nodes()];
    });

    simulation.value = sim;
  }

  /** Attach d3-zoom to an SVG element and keep `transform` reactive. */
  function bindSvg(svgEl: SVGSVGElement): void {
    const sel = select(svgEl);
    svgSelection.value = sel;

    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        transform.value = {
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        };
      });

    sel.call(behavior);
    zoomBehavior.value = behavior;
  }

  /** Reheat: bump alpha and restart. Useful after layout drifts. */
  function reheatSimulation(): void {
    const sim = simulation.value;
    if (!sim) return;
    sim.alpha(0.8).restart();
  }

  function resetZoom(): void {
    const sel = svgSelection.value;
    const behavior = zoomBehavior.value;
    if (!sel || !behavior) return;
    sel.transition().duration(300).call(behavior.transform, zoomIdentity);
  }

  function zoomIn(): void {
    const sel = svgSelection.value;
    const behavior = zoomBehavior.value;
    if (!sel || !behavior) return;
    sel.transition().duration(150).call(behavior.scaleBy, 1.4);
  }

  function zoomOut(): void {
    const sel = svgSelection.value;
    const behavior = zoomBehavior.value;
    if (!sel || !behavior) return;
    sel.transition().duration(150).call(behavior.scaleBy, 1 / 1.4);
  }

  /**
   * Drag a node: fix its position (fx/fy) while dragging and reheat the
   * simulation so neighbors follow. Release on mouseup.
   *
   * Returns the three event handlers the caller must wire to the node <g>.
   */
  function makeDragHandlers() {
    return {
      onDragStart(node: SimNode, event: MouseEvent | PointerEvent) {
        if (event.button !== undefined && event.button !== 0) return;
        const sim = simulation.value;
        if (!sim) return;
        node.fx = node.x;
        node.fy = node.y;
        sim.alphaTarget(0.2).restart();
      },
      onDragMove(node: SimNode, event: MouseEvent | PointerEvent) {
        if (node.fx == null || node.fy == null) return;
        // Convert screen delta to graph coords using current transform.
        const t = transform.value;
        const sel = svgSelection.value;
        if (!sel) return;
        const svg = sel.node() as SVGSVGElement | null;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const px = (event.clientX - rect.left - t.x) / t.k;
        const py = (event.clientY - rect.top - t.y) / t.k;
        node.fx = px;
        node.fy = py;
      },
      onDragEnd(node: SimNode) {
        const sim = simulation.value;
        if (!sim) return;
        node.fx = null;
        node.fy = null;
        sim.alphaTarget(0);
      },
    };
  }

  /** Fetch graph data from the backend and (re)build the simulation. */
  async function load(params?: { categoryPath?: string; tag?: string }): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const data: GraphData = await fetchGraph(params);
      // Map backend nodes to SimNode (x/y undefined until first tick).
      nodes.value = data.nodes.map((n: GraphNode) => ({
        id: n.id,
        label: n.label,
        tags: n.tags,
        categoryPath: n.categoryPath,
        degree: n.degree,
      }));
      edges.value = data.edges.map((e: GraphEdge) => ({
        source: e.source,
        target: e.target,
      }));
      buildSimulation();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  function selectNode(id: string | null): void {
    selectedNodeId.value = id;
  }

  function hoverNode(id: string | null): void {
    hoveredNodeId.value = id;
  }

  function clearSelection(): void {
    selectedNodeId.value = null;
    hoveredNodeId.value = null;
  }

  /** The currently selected node object (or null). */
  const selectedNode = computed<SimNode | null>(() => {
    const id = selectedNodeId.value;
    if (!id) return null;
    return nodes.value.find((n) => n.id === id) ?? null;
  });

  /** Edges touching the selected node (outgoing + incoming = backlinks view). */
  const selectedNodeLinks = computed<Array<{ edge: SimEdge; otherId: string }>>(() => {
    const id = selectedNodeId.value;
    if (!id) return [];
    const result: Array<{ edge: SimEdge; otherId: string }> = [];
    for (const e of edges.value) {
      const s = typeof e.source === 'object' ? e.source.id : e.source;
      const t = typeof e.target === 'object' ? e.target.id : e.target;
      if (s === id) result.push({ edge: e, otherId: t });
      else if (t === id) result.push({ edge: e, otherId: s });
    }
    return result;
  });

  /** Distinct categories present in the current node set (for the filter dropdown). */
  const categories = computed<string[]>(() => {
    const set = new Set<string>();
    for (const n of nodes.value) {
      if (n.categoryPath) set.add(n.categoryPath);
    }
    return [...set].sort();
  });

  /** Distinct tags present in the current node set. */
  const tags = computed<string[]>(() => {
    const set = new Set<string>();
    for (const n of nodes.value) {
      for (const t of n.tags) set.add(t);
    }
    return [...set].sort();
  });

  /** Stats for the badge. */
  const stats = computed(() => ({
    nodes: nodes.value.length,
    edges: edges.value.length,
  }));

  function destroy(): void {
    simulation.value?.stop();
    simulation.value = null;
    svgSelection.value = null;
    zoomBehavior.value = null;
  }

  return {
    // state
    nodes,
    edges,
    transform,
    hoveredNodeId,
    selectedNodeId,
    selectedNode,
    selectedNodeLinks,
    searchQuery,
    filterCategory,
    loading,
    error,
    // computed
    neighborSet,
    nodeDegreeMap,
    categories,
    tags,
    stats,
    // helpers
    getNodeRadius,
    getNodeColor,
    getNodeColorById,
    // lifecycle
    load,
    bindSvg,
    buildSimulation,
    reheatSimulation,
    resetZoom,
    zoomIn,
    zoomOut,
    makeDragHandlers,
    selectNode,
    hoverNode,
    clearSelection,
    destroy,
  };
}