#!/usr/bin/env python3
"""
Post-process graph.json: add @-alias import edges from all tsconfig.json files.
Auto-discovers tsconfig files recursively (skips node_modules, dist, .nuxt).
Follows extends chains. Resolves aliases relative to each tsconfig's directory.
Usage: python bin/enrich-graph.py
"""
import json, os, re, sys
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
GRAPH_PATH = REPO_ROOT / "graphify-out" / "graph.json"


# ── tsconfig discovery ──────────────────────────────────────────────

def discover_tsconfigs(root: Path) -> list[Path]:
    """Find all tsconfig*.json files recursively, skipping build artifacts."""
    configs = []
    for d in ["apps", "packages"]:
        search = root / d
        if not search.exists():
            continue
        for tc in search.rglob("tsconfig*.json"):
            path_str = str(tc)
            if any(skip in path_str for skip in ["node_modules", "dist", ".nuxt", ".turbo", "build", "out"]):
                continue
            configs.append(tc)
    return configs


def strip_json_comments(text: str) -> str:
    """Remove // and /∗∗/ comments from JSON-ish text."""
    text = re.sub(r"//.*?$", "", text, flags=re.MULTILINE)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    return text


def parse_paths(tsconfig: Path) -> dict[str, Path]:
    """
    Parse compilerOptions.paths from a tsconfig.json.
    Returns { alias_key (no */) : resolved_absolute_directory }.
    Follows extends chain up to 3 levels.
    """
    result = {}
    visited = set()

    for _ in range(4):  # max 4 extends deep
        if tsconfig in visited or not tsconfig.exists():
            break
        visited.add(tsconfig)

        text = tsconfig.read_text(encoding="utf-8")
        text = strip_json_comments(text)

        try:
            cfg = json.loads(text)
        except json.JSONDecodeError:
            # Some generated tsconfigs are invalid JSON even after stripping
            break

        base_url = cfg.get("compilerOptions", {}).get("baseUrl", ".")
        paths = cfg.get("compilerOptions", {}).get("paths", {})
        tsconfig_dir = tsconfig.parent.resolve()

        for alias, targets in paths.items():
            key = alias.rstrip("*").rstrip("/")
            if not targets:
                continue
            # Only process aliases that look project-internal (start with @)
            # Skip node_modules scoped packages like @nuxt/*, @vue/*, @intlify/*
            if not key.startswith("@"):
                continue
            # If key is a common scoped package prefix, skip
            if key in ("@nuxt", "@vue", "@intlify", "@nestjs", "@tanstack", "@pinia"):
                continue
            if key == "@@":
                continue  # Nuxt's internal alias

            for t in targets:
                t_clean = t.rstrip("*").rstrip("/")
                resolved = (tsconfig_dir / base_url / t_clean).resolve()
                result[key] = resolved

        # Follow extends
        extends = cfg.get("extends", "")
        if extends:
            tsconfig = (tsconfig.parent / extends).resolve()
        else:
            break

    return result


# ── graph manipulation ──────────────────────────────────────────────

def make_id(path: Path) -> str:
    """Replicate graphify's _make_id: relative to REPO_ROOT, lowercase, non-alnum→_."""
    try:
        rel = path.resolve().relative_to(REPO_ROOT)
    except ValueError:
        rel = path.resolve()
    s = str(rel).replace("\\", "/").lower()
    s = re.sub(r"[^a-z0-9/]", "_", s)
    return s.replace("/", "_").strip("_")


def resolve_import(import_path: str, aliases: dict[str, Path]) -> Optional[Path]:
    """
    Resolve @alias/rest to an absolute file Path.
    Tries .ts, .tsx, .vue, /index.ts, /index.vue.
    """
    # Sort: longer aliases first (e.g., @iam/auth before @iam)
    for alias, base_dir in sorted(aliases.items(), key=lambda x: -len(x[0])):
        if import_path == alias:
            for candidate in [
                base_dir / "index.ts",
                base_dir / "index.vue",
            ]:
                if candidate.exists():
                    return candidate
        elif import_path.startswith(alias + "/"):
            rest = import_path[len(alias) + 1:]
            candidates = [
                base_dir / f"{rest}.ts",
                base_dir / f"{rest}.tsx",
                base_dir / f"{rest}.vue",
                base_dir / rest,  # already has extension
                base_dir / rest / "index.ts",
                base_dir / rest / "index.vue",
            ]
            for c in candidates:
                if c.exists():
                    return c
    return None


def enrich_graph(graph_path: Path) -> dict:
    """Add @-alias import edges to graph.json. Returns modified graph dict."""
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    nodes = graph.get("nodes", [])
    links = graph.get("links", graph.get("edges", []))

    # Index: file node IDs present in graph
    file_nids: set[str] = set()
    for n in nodes:
        sf = n.get("source_file", "")
        if sf and Path(sf).suffix in (".ts", ".tsx", ".vue", ".js", ".mjs"):
            file_nids.add(make_id(Path(sf)))

    # Discover all aliases
    tsconfigs = discover_tsconfigs(REPO_ROOT)
    all_aliases: dict[str, Path] = {}
    for tc in tsconfigs:
        all_aliases.update(parse_paths(tc))

    if not all_aliases:
        print(f"  No @ aliases found in {len(tsconfigs)} tsconfig(s)", file=sys.stderr)
        return graph

    print(f"  {len(tsconfigs)} tsconfig(s) → {len(all_aliases)} aliases: "
          f"{', '.join(sorted(all_aliases.keys())[:10])}...", file=sys.stderr)

    # Collect unique source files from nodes (avoid re-reading same file)
    source_files: set[str] = set()
    for n in nodes:
        sf = n.get("source_file", "")
        if sf and Path(sf).suffix in (".ts", ".tsx", ".vue"):
            source_files.add(sf)

    # Scan each source file for @ imports
    IMPORT_RE = re.compile(r"""from\s+['"](@[^'"]+)['"]""")
    new_edges: list[dict] = []
    seen_edge_keys: set[tuple] = set()
    files_scanned = 0
    files_with_imports = 0

    for sf in source_files:
        file_path = Path(sf)
        if not file_path.exists():
            continue
        try:
            content = file_path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        files_scanned += 1
        imports = set(IMPORT_RE.findall(content))
        file_imports = [
            imp for imp in imports
            if not imp.startswith(("@nestjs/", "@nuxt/", "@vue/", "@tanstack/",
                                   "@pinia/", "@intlify/", "@vee-validate/", "@unhead/"))
        ]
        if not file_imports:
            continue

        files_with_imports += 1

        # For each node that belongs to this file, add edges
        for n in nodes:
            if n.get("source_file") != sf:
                continue

            for import_path in file_imports:
                target_file = resolve_import(import_path, all_aliases)
                if target_file is None:
                    continue

                target_id = make_id(target_file)
                if target_id not in file_nids:
                    continue

                edge_key = (n["id"], target_id, "imports_from")
                if edge_key not in seen_edge_keys:
                    new_edges.append({
                        "source": n["id"],
                        "target": target_id,
                        "relation": "imports_from",
                        "confidence": "EXTRACTED",
                        "confidence_score": 1.0,
                        "source_file": sf,
                        "source_location": f"@{import_path}",
                        "weight": 1.0,
                    })
                    seen_edge_keys.add(edge_key)

    # Merge: avoid duplicates
    existing = {(e.get("source"), e.get("target"), e.get("relation")) for e in links}
    added = 0
    for e in new_edges:
        key = (e["source"], e["target"], e["relation"])
        if key not in existing:
            links.append(e)
            existing.add(key)
            added += 1

    graph["links"] = links
    if "edges" in graph:
        graph["edges"] = links

    print(f"  Scanned {files_scanned} files ({files_with_imports} with @ imports)", file=sys.stderr)
    print(f"  Added {added} @-alias import edges", file=sys.stderr)
    return graph


# ── main ────────────────────────────────────────────────────────────

def main():
    import argparse
    p = argparse.ArgumentParser(description="Add @-alias import edges to graph.json")
    p.add_argument("--graph", default=None, help="Path to graph.json (default: graphify-out/graph.json)")
    args = p.parse_args()

    graph_path = REPO_ROOT / args.graph if args.graph else GRAPH_PATH
    if not graph_path.exists():
        print(f"Error: {graph_path} not found. Run graphify first.", file=sys.stderr)
        sys.exit(1)

    print(f"Enriching: {graph_path.relative_to(REPO_ROOT)}", file=sys.stderr)
    enriched = enrich_graph(graph_path)

    graph_path.write_text(
        json.dumps(enriched, indent=2, ensure_ascii=False),
        encoding="utf-8"
    )
    print(f"Written: {len(enriched['links'])} total edges", file=sys.stderr)


if __name__ == "__main__":
    main()
