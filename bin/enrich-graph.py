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


def parse_nuxt_layers(root: Path) -> dict[str, Path]:
    """
    Parse nuxt.config.ts files for Nuxt layer aliases.
    Nuxt auto-creates aliases from `extends: ['./modules/xxx']` as `@xxx`.
    Also detects root alias `@` → `apps/front/`.
    Returns { alias_key (without */) : resolved_absolute_directory }.
    """
    aliases = {}

    for nuxt_config in root.glob("apps/*/nuxt.config.ts"):
        app_dir = nuxt_config.parent.resolve()
        try:
            text = nuxt_config.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        # Parse `extends: ['./modules/foo', './modules/bar']`
        extends_match = re.search(
            r"extends\s*:\s*\[([^\]]+)\]",
            text
        )
        if extends_match:
            for layer_path in re.findall(r"""['"](\./[^'"]+)['"]""", extends_match.group(1)):
                layer_dir = (app_dir / layer_path).resolve()
                if layer_dir.exists():
                    alias_name = layer_dir.name  # "base", "cms", "landing"
                    aliases[f"@{alias_name}"] = layer_dir

        # Parse nested nuxt.config.ts in modules/ for sub-layers
        for module_dir in (app_dir / "modules").iterdir() if (app_dir / "modules").exists() else []:
            sub_config = module_dir / "nuxt.config.ts"
            if not sub_config.exists() or not module_dir.is_dir():
                continue
            try:
                sub_text = sub_config.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            sub_extends = re.search(r"extends\s*:\s*\[([^\]]+)\]", sub_text)
            if sub_extends:
                for layer_path in re.findall(r"""['"](\./[^'"]+)['"]""", sub_extends.group(1)):
                    sub_layer_dir = (module_dir / layer_path).resolve()
                    if sub_layer_dir.exists():
                        alias_name = sub_layer_dir.name  # "auth", "translations", "error-tracker", "ui-app"
                        aliases[f"@{alias_name}"] = sub_layer_dir

    # Add root @ alias if front app dir exists
    for app_dir in [root / "apps" / "front", root / "apps" / "web"]:
        if app_dir.exists():
            aliases["@"] = app_dir.resolve()

    return aliases


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


# ── Frontend ↔ Backend API linking ──────────────────────────────────

def extract_backend_routes(nodes: list[dict]) -> dict[str, list[tuple[str, str, str]]]:
    """
    Parse backend controllers for HTTP routes.
    Returns: { normalized_path: [(method, node_id, label), ...] }
    E.g., { "users": [("GET","...","findAll"),("POST","...","create")] }
    """
    routes: dict[str, list[tuple[str, str, str]]] = {}

    # Group nodes by source file
    files: dict[str, list[dict]] = {}
    for n in nodes:
        sf = n.get("source_file", "")
        sf_norm = sf.replace("\\", "/")
        if sf_norm.endswith(".controller.ts") and "apps/back" in sf_norm:
            files.setdefault(sf_norm, []).append(n)

    for sf, file_nodes in files.items():
        try:
            text = Path(sf).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        # Extract controller path
        base_path = ""
        ctrl = re.search(r"""@Controller\(\s*\{[^}]*path\s*:\s*['"]([^'"]+)['"][^}]*\}""", text)
        if not ctrl:
            ctrl = re.search(r"""@Controller\(['"]([^'"]+)['"]""", text)
        if ctrl:
            base_path = ctrl.group(1).strip("/")

        # Extract method decorators with their handler
        for m in re.finditer(
            r"@(Get|Post|Put|Patch|Delete)\s*\(\s*([^)]*)\s*\)",
            text
        ):
            method = m.group(1).upper()
            arg = m.group(2).strip("'\" ")
            # arg could be ':id' or empty or "profile-photo"
            sub_path = arg.strip("/") if arg else ""

            # Build full route
            if sub_path:
                full = f"{base_path}/{sub_path}" if base_path else sub_path
            else:
                full = base_path

            # Normalize: replace :param with :param, add leading /
            full = re.sub(r":\w+", ":param", full)
            if not full.startswith("/"):
                full = "/" + full

            # Find handler node (method name after decorator line)
            pos = m.end()
            # Look for the actual handler method (skip stacked decorators)
            remaining = text[pos:]
            handler_name = ""
            for handler_line in remaining.split("\n"):
                stripped = handler_line.strip()
                # Skip decorators, comments, blank lines
                if stripped.startswith("@") or stripped.startswith("//") or not stripped:
                    continue
                handler_match = re.search(r"(?:async\s+)?(\w+)\s*\(", stripped)
                if handler_match:
                    handler_name = handler_match.group(1)
                    break

            # Find node for this handler (substring match in label)
            for fn in file_nodes:
                label = fn.get("label", "")
                if handler_name and handler_name in label:
                    routes.setdefault(full, []).append(
                        (method, fn["id"], fn.get("label", handler_name))
                    )
                    break
            else:
                # Fallback: use file node
                for fn in file_nodes:
                    if fn["id"].endswith(Path(sf).stem):
                        routes.setdefault(full, []).append(
                            (method, fn["id"], handler_name)
                        )
                        break

    return routes


def normalize_api_url(url: str) -> str:
    """Normalize a frontend URL pattern to match backend routes.
    Strips base URL variables (${baseURL}, ${apiUrl}) but keeps path params.
    """
    # Replace path parameters (${id}, ${slug}, ${userId}) with :param
    url = re.sub(r"\$\{(?:id|slug|userId|user|pageId|postId|categoryId|entityId|lang)\}",
                 ":param", url)
    # Remove base URL variables completely (case-insensitive)
    url = re.sub(r"\$\{baseURL\}|\$\{baseUrl\}|\$\{apiUrl\}|\$\{apiPrefix\}|\$\{config\.public\.apiUrl\}", "", url, flags=re.IGNORECASE)
    # Strip api prefix
    url = re.sub(r"/api(?:/v\d+)?", "", url)
    url = re.sub(r"\?.*$", "", url)
    url = url.strip().rstrip("/")
    if not url.startswith("/"):
        url = "/" + url
    # Collapse multiple ///
    url = re.sub(r"/+", "/", url)
    return url


def link_api_calls(
    graph: dict, nodes: list[dict], links: list[dict], file_nids: set[str]
) -> list[dict]:
    """
    Link frontend API calls to backend controller routes.
    Returns new edges to add.
    """
    # 1. Index backend routes
    backend_routes = extract_backend_routes(nodes)
    if not backend_routes:
        print(f"  No backend routes found", file=sys.stderr)
        return []

    print(f"  Backend routes: {sum(len(v) for v in backend_routes.values())} "
          f"across {len(backend_routes)} paths", file=sys.stderr)

    # 2. Scan frontend files for API calls
    # Pattern: find ALL URL-like paths in frontend code
    # Handles both inline fetchWrapper.post(`${baseURL}/users`) and
    # indirect uses: const url = `${baseURL}/users`; fetchWrapper.get(url)
    API_PATH_RE = re.compile(
        r"`[^`]*?(?:/users|/auth|/products|/categories|/posts|/pages|/media|/seo|/sitemap|"
        r"/files|/storage|/translations|/langs|/billing|/stripe|/errors|/sessions|/api-keys|"
        r"/roles|/home|/webhooks|/blog|/cms|/email)[^`]*`",
        re.IGNORECASE
    )

    # Also find REST calls: fetchWrapper.method(...)
    CALL_RE = re.compile(
        r"""(?:fetchWrapper|api)\s*\.\s*(get|post|put|patch|delete)\s*\(([^)]+)\)""",
        re.IGNORECASE
    )

    new_edges: list[dict] = []
    seen = set()

    for n in nodes:
        sf = n.get("source_file", "")
        sf_norm = sf.replace("\\", "/")
        if not sf_norm or "apps/front" not in sf_norm:
            continue
        try:
            content = Path(sf).read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        # Find all URL-like paths in this file
        url_matches = set()
        for m in API_PATH_RE.finditer(content):
            raw_url = m.group(0).strip("`")
            url_matches.add(normalize_api_url(raw_url))

        if not url_matches:
            continue

        # Try to infer HTTP method from context
        # Default to GET if can't determine
        call_contexts = []
        for m in CALL_RE.finditer(content):
            call_method = m.group(1).upper()
            call_args = m.group(2)
            # Check if any of our URL paths appear in this call
            for url in url_matches:
                # Loose match: the URL path segment appears in the call args
                url_segment = url.strip("/").split("/")[-1]
                if url_segment and url_segment in call_args:
                    call_contexts.append((call_method, url))
                    break

        # If no method-context matches, assign all URL paths as GET
        if not call_contexts:
            for url in url_matches:
                call_contexts.append(("GET", url))

        # Match against backend routes
        for method, front_path in set(call_contexts):
            # Try exact match first, then partial
            for backend_path, handlers in backend_routes.items():
                for handler_method, handler_nid, handler_label in handlers:
                    if method != handler_method:
                        continue

                    # Match paths
                    backend_norm = backend_path.rstrip("/")
                    front_norm = front_path.rstrip("/")

                    if backend_norm == front_norm:
                        pass  # exact match
                    elif backend_norm and front_norm and backend_norm in front_norm:
                        pass  # partial match
                    else:
                        continue

                    edge_key = (n["id"], handler_nid, "calls_api")
                    if edge_key not in seen:
                        new_edges.append({
                            "source": n["id"],
                            "target": handler_nid,
                            "relation": "calls_api",
                            "confidence": "EXTRACTED",
                            "confidence_score": 1.0,
                            "source_file": sf,
                            "source_location": f"{method} {front_path}",
                            "weight": 1.0,
                        })
                        seen.add(edge_key)

    return new_edges


# ── enrich_graph ─────────────────────────────────────────────────────

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

    # Discover all aliases: tsconfig paths + Nuxt layers
    tsconfigs = discover_tsconfigs(REPO_ROOT)
    all_aliases: dict[str, Path] = {}
    for tc in tsconfigs:
        all_aliases.update(parse_paths(tc))
    nuxt_aliases = parse_nuxt_layers(REPO_ROOT)
    all_aliases.update(nuxt_aliases)

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

    # Phase 3: Link frontend API calls to backend routes
    api_edges = link_api_calls(graph, nodes, links, file_nids)
    added_api = 0
    for e in api_edges:
        key = (e["source"], e["target"], e["relation"])
        if key not in existing:
            links.append(e)
            existing.add(key)
            added_api += 1

    graph["links"] = links
    if "edges" in graph:
        graph["edges"] = links

    print(f"  Added {added_api} front→back API call edges", file=sys.stderr)
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
