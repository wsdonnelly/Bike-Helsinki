# Graph Data Architecture: Migrating to Object Storage for Finland-Scale Growth

**Date:** 2026-03-25  
**Status:** Recommended

---

## Current State

| File | Size |
|---|---:|
| `graph_nodes.bin` | 21 MB |
| `graph_edges.bin` | 35 MB |
| **Total** | **56 MB** |

Today both graph binaries live in the repo and are deployed with the backend.

That is workable for Helsinki, but it does not scale well to Finland-sized data:

1. Git history accumulates binary blobs permanently.
2. Pushes and deploys get slower as binaries grow.
3. Render starter instances have limited ephemeral disk.
4. The data is operationally an artifact, not source code.

The backend architecture already points toward a better model:

- `route.node` is the primary graph owner.
- `route.node` memory-maps the node and edge binaries at startup.
- `kd_snap.node` is secondary and follows the resolved node path chosen by `route.node`.
- The JS layer caches native-reported graph metadata; it does not own graph loading.

That means object storage is a good fit, but only if startup sequencing is treated as part of backend correctness.

---

## Key Architectural Constraint

The backend does **not** support hot-swapping graph files under a running process.

The current runtime model is:

1. graph files must already exist locally
2. native addons initialize at process startup
3. `route.node` maps the graph and reports graph metadata
4. `kd_snap.node` initializes second using the route-owned node path
5. the process serves requests against that fixed dataset until restart

So the migration should not be framed as "download files if missing and keep going." It should be framed as:

`materialize one complete graph dataset locally -> verify it -> start Node once`

That is the safe operational model.

---

## Key Architectural Insight: mmap Still Scales

The A* routing side still requires no algorithmic redesign for Finland-wide data.

Because `route.cpp` uses read-only `mmap`, the OS only pages in the graph regions touched by a query. A Helsinki route on a Finland-wide graph should have roughly the same active working-set behavior as today. The main eager memory cost of scaling coverage is still the KD-tree / node-coordinate load for snapping.

Estimated Finland scale remains plausible on the current architecture:

- Nodes: ~7–10 M
- Edges: ~15–20 M
- Binary size: ~600–900 MB
- KD-tree / node-coordinate memory: ~120–160 MB

This is large for git, but still reasonable for local-disk-plus-mmap on a 2 GB service if startup is handled carefully.

---

## Revised Recommended Plan

### Phase 1: Move Graph Artifacts to Cloudflare R2

**Why R2**

- 10 GB free-tier storage is enough for multiple regional datasets.
- No egress charge for the backend fetching the binaries.
- It separates deployable code from generated graph artifacts.

### Required Assumptions

This migration is viable if all of these are true:

1. The backend continues to load one graph dataset at startup and treat it as read-only for the life of the process.
2. `graph_nodes.bin` and `graph_edges.bin` are treated as one versioned pair.
3. The full pair is downloaded and verified before `node index.js` starts.
4. Dataset replacement happens via restart/redeploy, not in-place under a running process.

### Safer Startup Sequence

Use this model instead of a simple “if files exist, skip download” flow:

```text
Render deploys
-> startup wrapper runs
-> fetch graph manifest from R2
-> decide which dataset version should be active
-> ensure local staging directory exists
-> download nodes + edges into staging paths
-> verify sizes/checksums for both files
-> atomically promote staging files into active paths
-> start node index.js
-> route.node initializes
-> kd_snap.node initializes from route-owned node path
-> serve traffic
```

This avoids booting against:

- partially downloaded files
- mismatched node/edge versions
- stale leftovers from an earlier dataset

### Recommended Artifact Layout

Prefer versioned objects in R2 instead of replacing the same filenames in place.

Example:

```text
graphs/
  helsinki-2026-03-25/
    manifest.json
    graph_nodes.bin
    graph_edges.bin
  finland-2026-06-10/
    manifest.json
    graph_nodes.bin
    graph_edges.bin
```

Suggested `manifest.json` fields:

- `datasetId`
- `createdAt`
- `nodesFile`
- `edgesFile`
- `nodesBytes`
- `edgesBytes`
- `nodesSha256`
- `edgesSha256`

That gives the startup script one authoritative description of the dataset pair.

### Concrete Implementation Changes

| File | Change |
|---|---|
| `.gitignore` | Add `backend/data/*.bin` |
| `backend/scripts/fetch-graph.js` | New: fetch manifest, download graph pair to staging, verify, promote |
| `backend/scripts/start-with-graph.sh` | New: wrapper that fetches graph artifacts before starting Node |
| `render.yaml` | Update start command to use startup wrapper; add R2 env vars |
| `backend/data/` | Treat as runtime artifact directory, not source-controlled data |

### Suggested Environment Variables

| Variable | Purpose |
|---|---|
| `GRAPH_R2_BASE_URL` | Base URL for R2 public bucket or signed-access endpoint |
| `GRAPH_DATASET_ID` | Which dataset/version should be fetched |
| `GRAPH_LOCAL_DIR` | Local active directory for runtime graph files |
| `GRAPH_DOWNLOAD_DIR` | Temporary staging directory for downloads |

### Important Note on Code Changes

No routing algorithm changes are required.

But this is **not** literally “no backend changes.” The startup path becomes part of backend correctness, because the native addons assume the graph files exist before module initialization. The migration is still low-risk, but the fetch/verify/start orchestration is operational code, not just deploy glue.

### Optional Enhancement: Render Persistent Disk

If Finland-sized datasets become the default, Render persistent disk becomes attractive:

- avoids downloading large binaries on every redeploy
- reduces cold-start variance
- keeps the same startup model

For this project, persistent disk is an optimization, not a prerequisite.

---

## Phase 2: Expand to Finland

Once R2-backed startup is in place, Finland expansion is mostly a data-pipeline change:

1. Update the ingest pipeline to build a Finland dataset.
2. Produce a versioned dataset directory with `manifest.json`, `graph_nodes.bin`, and `graph_edges.bin`.
3. Upload that dataset to R2.
4. Change `GRAPH_DATASET_ID`.
5. Redeploy so the backend fetches the new dataset before boot.

This is safer than replacing Helsinki files in place because it preserves atomicity and rollback.

### Rollback Story

Versioned datasets also make rollback trivial:

1. change `GRAPH_DATASET_ID` back to the previous version
2. redeploy
3. backend fetches previous dataset and boots against it

That is much safer than overwriting one mutable pair of object names.

---

## Phase 3: Spatial Tiling Only If Single-Binary Fails

Spatial tiling is still the last resort.

It should only happen if a single Finland-scale dataset proves insufficient due to:

- startup time
- disk limits
- RAM pressure from snap structures
- unacceptable operational complexity around large artifact downloads

Until that is demonstrated, a single versioned binary pair is the simpler and more robust architecture.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Partial download | Process boots against corrupt dataset | Download to staging, verify checksums, promote only when complete |
| Nodes/edges mismatch | Undefined routing behavior | Treat both files as one manifest-defined dataset |
| In-place object replacement | Race between versions | Use versioned dataset paths in R2 |
| Slow cold starts | Longer deploy availability window | Accept initially; add persistent disk later if needed |
| Backend starts before fetch completes | Native addon init failure | Use startup wrapper; do not start Node until fetch succeeds |

---

## Decision Summary

| Approach | Cost | Code Changes | Operational Risk | Recommendation |
|---|---|---|---|---|
| **R2 + startup fetch/verify + current mmap** | Low | Low | Low | **Recommended now** |
| **R2 + Finland single-binary dataset** | Low | Low | Medium | **Recommended when ready** |
| Render persistent disk | Low | Very low | Lower cold-start risk | Optional optimization |
| Spatial tiling | Higher complexity | High | High | Only if single-binary fails |
| Git LFS | Limited relief | Low | Medium | Not recommended |

---

## Bottom Line

The migration to R2 is viable and aligns with the backend architecture, but the correct model is not “object storage plus opportunistic download.”

The correct model is:

`versioned graph dataset in object storage -> verified local materialization before boot -> native startup against one fixed dataset`

That keeps the current route-first graph ownership intact while removing graph binaries from git and making Finland-scale growth operationally manageable.
