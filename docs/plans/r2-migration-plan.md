# Graph Data Architecture: Migrating to Object Storage for Finland-Scale Growth

**Date:** 2026-03-25
**Status:** Recommended — R2 migration imminent

---

## Current State

| File | Size |
|---|---|
| graph_nodes.bin | 21 MB |
| graph_edges.bin | 35 MB |
| **Total** | **56 MB** |

Both files live in the git repo and are shipped to Render on every deploy. Routing uses read-only mmap (lazy OS paging) for edges, and a fully in-RAM KD-tree for node snapping.

**Deployment:** Render $7/mo Starter — 1 CPU, 2 GB RAM, ephemeral disk (wiped on redeploy).

---

## The Bottleneck

Git is not a data store. At 56 MB this works, but Finland-wide data (~600–900 MB) breaks it:

1. Git repo accumulates binary history permanently
2. Large binaries slow every push/deploy
3. Render ephemeral disk is ~1 GB — Finland data would fill it
4. Finland KD-tree: ~7–10 M nodes × 16 bytes ≈ **120–160 MB RAM** — fits in 2 GB, but not something to push through git

---

## Key Architectural Insight: mmap Already Scales

The A* routing side requires **no code changes** to handle Finland-wide data. Because `route.cpp` uses read-only `mmap`, the OS only pages in the graph regions touched by a query. A Helsinki route on a Finland-wide binary has essentially the same memory footprint as today. The only real memory cost of expanding coverage is the KD-tree, which loads all coordinates eagerly — and at ~160 MB for Finland, this fits comfortably in 2 GB RAM.

---

## Recommended Plan

### Phase 1: Move Binaries to Cloudflare R2 (Immediate)

**Why R2:** Free tier gives 10 GB storage and zero egress fees (no per-GB charge when Render downloads the files). Enough for many regional datasets.

**Startup flow:**
```
Render deploys → start command runs fetch script → check if .bin files exist on disk
→ if not, download from R2 → mmap and serve
```

Download adds ~5–15 s to cold starts but zero latency to routing thereafter. Since Render's ephemeral disk is wiped on redeploy, the download runs each deploy (~15–30 s for Finland-sized files — acceptable).

**Files to change:**
| File | Change |
|---|---|
| `.gitignore` | Add `backend/data/*.bin` |
| `backend/scripts/fetch-graph.js` | New: downloads from R2 on startup |
| `render.yaml` | Update start command; add `GRAPH_R2_BASE_URL` env var |

No changes to routing, A*, mmap, or KD-tree code.

**Optional enhancement — Render Persistent Disk ($0.25/GB/mo):** Mounts across redeploys, eliminating the per-deploy download. For Finland (~800 MB), that's ~$0.20/mo. Worth it once Finland data is in use.

---

### Phase 2: Expand to Finland (When Ready)

With R2 in place and already on the $7/mo plan, expanding to Finland is a data-pipeline change only:

1. Update `ingest/all.sh` — change bbox/polygon from Helsinki to all of Finland (OSM Geofabrik Finland extract)
2. Run the build pipeline locally: `./all.sh`
3. Upload the new binaries to R2 (replacing Helsinki files, or using versioned paths)
4. Redeploy — backend downloads Finland binaries, starts up, done

**Estimated Finland graph:**
- Nodes: ~7–10 M (vs ~500 K for Helsinki)
- Edges: ~15–20 M (vs ~1.5 M for Helsinki)
- Binary size: ~600–900 MB total
- KD-tree RAM: ~120–160 MB
- A* memory per query: unchanged (mmap paging)

No routing code changes required.

---

### Phase 3: Spatial Tiling (Only If Needed)

If graph size exceeds R2 or RAM limits (unlikely at Finland scale), tiles become relevant:

- Divide Finland into ~15 regional tiles by maakunta (Uusimaa, Varsinais-Suomi, Pirkanmaa, etc.)
- Each tile ~40–80 MB, loaded on demand, cached in memory
- Cross-tile routing: use an overlap buffer zone per tile (simpler than border-node stitching)

This is significantly more complex and is **not recommended until Finland single-binary proves insufficient**.

---

## Decision Summary

| Approach | Cost | Code Changes | Performance |
|---|---|---|---|
| **R2 + current mmap** (Phase 1) | $0 | Low | Excellent |
| **R2 + Finland binary** (Phase 2) | $0 storage + $7 Render (already paying) | Data pipeline only | Excellent |
| Render persistent disk (optional) | +$0.20/mo | render.yaml only | Excellent (no cold-start download) |
| Spatial tiling (Phase 3) | $0 | High | Good |
| Git LFS | Free (limited bandwidth) | Low | Not recommended |
