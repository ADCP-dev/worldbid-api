#!/usr/bin/env python3
"""
Query the Foundation knowledge graph. Designed for AI agents.
Usage:
  python bin/graph-query.py <search_terms>                    # BFS from matching nodes (default)
  python bin/graph-query.py <search_terms> --depth 2           # Custom BFS depth
  python bin/graph-query.py <search_terms> --mode dfs          # DFS traversal
  python bin/graph-query.py <source> <target> --mode path      # Shortest path between 2 nodes
  python bin/graph-query.py <search_terms> --mode explain      # List nodes with descriptions
  python bin/graph-query.py --stats                            # Graph statistics

Output: plain text, structured for easy agent consumption.
"""
import json, sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
GRAPH_PATH = REPO_ROOT / "graphify-out" / "graph.json"


def load_graph() -> tuple:
    """Load graph, return (nodes_by_id, edges, nx_graph if available)."""
    data = json.loads(GRAPH_PATH.read_text(encoding="utf-8"))
    nodes = {n["id"]: n for n in data.get("nodes", data.get("node_data", []))}
    links = data.get("links", data.get("edges", []))
    return nodes, links


def match_nodes(nodes: dict, terms: list[str], limit: int = 10) -> list[tuple[str, int]]:
    """Score nodes by term overlap in labels, return top matches."""
    scored = []
    for nid, ndata in nodes.items():
        label = ndata.get("label", "").lower()
        src = ndata.get("source_file", "").lower()
        score = sum(1 for t in terms if t in label or t in src)
        if score > 0:
            scored.append((nid, score))
    scored.sort(key=lambda x: -x[1])
    return scored[:limit]


def bfs(nodes: dict, edges: list, start_ids: list[str], depth: int = 3) -> tuple[set, list]:
    """BFS from start nodes up to given depth."""
    # Build adjacency
    adj = {}
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s and t:
            adj.setdefault(s, set()).add(t)
            adj.setdefault(t, set()).add(s)

    visited = set(start_ids)
    frontier = set(start_ids)
    found_edges = []

    for _ in range(depth):
        nxt = set()
        for n in frontier:
            for nb in adj.get(n, set()):
                if nb not in visited:
                    nxt.add(nb)
                    found_edges.append((n, nb))
        visited.update(nxt)
        frontier = nxt

    return visited, found_edges


def dfs(nodes: dict, edges: list, start_ids: list[str], depth: int = 5) -> tuple[set, list]:
    """DFS from start nodes up to given depth."""
    adj = {}
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s and t:
            adj.setdefault(s, set()).add(t)
            adj.setdefault(t, set()).add(s)

    visited = set()
    found_edges = []
    stack = [(n, 0) for n in reversed(start_ids)]

    while stack:
        node, d = stack.pop()
        if node in visited or d > depth:
            continue
        visited.add(node)
        for nb in adj.get(node, set()):
            if nb not in visited:
                stack.append((nb, d + 1))
                found_edges.append((node, nb))

    return visited, found_edges


def shortest_path(nodes: dict, edges: list, src_term: str, tgt_term: str) -> list | None:
    """Find shortest path between two node labels (partial match)."""
    adj = {}
    for e in edges:
        s, t = e.get("source"), e.get("target")
        if s and t:
            adj.setdefault(s, set()).add(t)
            adj.setdefault(t, set()).add(s)

    # Find source/target nodes
    src_id = tgt_id = None
    for nid, ndata in nodes.items():
        label = ndata.get("label", "").lower()
        if src_term.lower() in label and src_id is None:
            src_id = nid
        if tgt_term.lower() in label and tgt_id is None:
            tgt_id = nid
    if not src_id or not tgt_id:
        return None

    # BFS from source
    from collections import deque
    q = deque([src_id])
    parent = {src_id: None}
    while q:
        u = q.popleft()
        if u == tgt_id:
            # Reconstruct path
            path = []
            while u:
                path.append(u)
                u = parent[u]
            return list(reversed(path))
        for v in adj.get(u, set()):
            if v not in parent:
                parent[v] = u
                q.append(v)
    return None


def format_node(nid: str, nodes: dict) -> str:
    n = nodes.get(nid, {})
    label = n.get("label", nid)
    src = n.get("source_file", "").replace(str(REPO_ROOT).replace("\\", "/"), "")
    src = src.lstrip("/")
    return f"{label} [{src}]" if src else label


def format_edge(src: str, tgt: str, nodes: dict, edges: list) -> str:
    # Find edge details
    rel = "?"
    for e in edges:
        if (e.get("source") == src and e.get("target") == tgt) or \
           (e.get("source") == tgt and e.get("target") == src):
            rel = e.get("relation", "?")
            break
    return f"{format_node(src, nodes)} --{rel}--> {format_node(tgt, nodes)}"


def find_graph() -> Path:
    """Auto-find graph.json relative to repo root or cwd."""
    candidates = [
        REPO_ROOT / "graphify-out" / "graph.json",
        Path.cwd() / "graphify-out" / "graph.json",
        Path.cwd() / "graph.json",
    ]
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError(
        f"graph.json not found. Looked in: {[str(c) for c in candidates]}\n"
        "Run 'graphify .' first or place graph.json in graphify-out/"
    )


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Query the Foundation knowledge graph")
    parser.add_argument("terms", nargs="*", help="Search terms or node names")
    parser.add_argument("--mode", choices=["bfs", "dfs", "path", "explain", "stats"],
                        default="bfs", help="Query mode")
    parser.add_argument("--depth", type=int, default=3, help="Traversal depth (default: 3)")
    parser.add_argument("--limit", type=int, default=15, help="Max results to show")
    parser.add_argument("--graph", default=None, help="Path to graph.json (auto-detected)")
    args = parser.parse_args()

    global GRAPH_PATH
    if args.graph:
        GRAPH_PATH = Path(args.graph)
    else:
        GRAPH_PATH = find_graph()

    if not GRAPH_PATH.exists():
        print(f"ERROR: No graph found at {GRAPH_PATH}. Run graphify first.", file=sys.stderr)
        sys.exit(1)

    nodes, links = load_graph()
    terms = [t.lower() for t in args.terms]

    if args.mode == "stats":
        from collections import Counter
        print(f"Nodes: {len(nodes)}")
        print(f"Edges: {len(links)}")
        rels = Counter(e.get("relation", "?") for e in links)
        print("Relations:", ", ".join(f"{r}={c}" for r, c in rels.most_common()))

        # File count
        files = set(n.get("source_file", "") for n in nodes.values() if n.get("source_file"))
        print(f"Source files: {len(files)}")
        return

    if not terms and args.mode != "stats":
        print("Usage: graph-query.py <terms> [--mode bfs|dfs|path|explain] [--depth N]")
        print("Example: graph-query.py auth decorator guard --depth 2")
        return

    if args.mode == "path":
        if len(terms) < 2:
            print("Path mode needs two nodes: graph-query.py <source> <target> --mode path")
            return
        path = shortest_path(nodes, links, terms[0], terms[1])
        if not path:
            print(f"No path found between '{terms[0]}' and '{terms[1]}'")
            return
        print(f"Path ({len(path) - 1} hops):")
        for i, nid in enumerate(path):
            prefix = "  " + ("└─ " if i == len(path) - 1 else "├─ ")
            print(f"{prefix}{format_node(nid, nodes)}")
        return

    if args.mode == "explain":
        matched = match_nodes(nodes, terms, args.limit)
        if not matched:
            print(f"No nodes matching: {terms}")
            return
        print(f"Nodes matching {terms}:")
        for nid, score in matched:
            n = nodes[nid]
            src = n.get("source_file", "").replace(str(REPO_ROOT).replace("\\", "/"), "")
            print(f"  [{score}] {n['label']} ({src})")
        return

    # BFS or DFS
    matched = match_nodes(nodes, terms, args.limit)
    if not matched:
        print(f"No nodes matching: {terms}")
        return

    start_ids = [nid for nid, _ in matched[:5]]
    start_labels = [nodes[nid]["label"] for nid in start_ids]
    print(f"Query: {' '.join(args.terms)}")
    print(f"Mode: {args.mode.upper()} depth={args.depth}")
    print(f"Start: {', '.join(start_labels[:5])}")
    print()

    if args.mode == "dfs":
        visited, found_edges = dfs(nodes, links, start_ids, args.depth)
    else:
        visited, found_edges = bfs(nodes, links, start_ids, args.depth)

    print(f"Traversed: {len(visited)} nodes, {len(found_edges)} edges")
    print()

    # Rank by relevance to terms
    def relevance(nid):
        label = nodes.get(nid, {}).get("label", "").lower()
        src = nodes.get(nid, {}).get("source_file", "").lower()
        return sum(1 for t in terms if t in label or t in src)

    ranked = sorted(visited, key=relevance, reverse=True)

    print("--- NODES ---")
    for nid in ranked[:args.limit]:
        print(f"  {format_node(nid, nodes)}")

    print(f"\n--- EDGES ---")
    shown = 0
    for u, v in found_edges:
        if shown >= args.limit:
            break
        if u in visited and v in visited:
            print(f"  {format_edge(u, v, nodes, links)}")
            shown += 1


if __name__ == "__main__":
    main()
