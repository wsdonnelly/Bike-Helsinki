# BikeMap Application Architecture

## System Overview

```mermaid
flowchart TD
    %% Data Sources
    OSM[OSM PBF File<br/>raw_data/]

    %% Ingestion Process
    subgraph INGEST [" 🔄 bikemap/injest "]
        BUILD[buildGraph.cpp<br/>Main ingestion process]
        WAY[WayCollector<br/>Extract bike/foot ways]
        NODE[NodeCollector<br/>Extract coordinates]
        WRITE[writeBlobs<br/>Serialize to binary]
    end

    %% Generated Data
    subgraph DATA [" 💾 bikemap/data "]
        NODES[graph_nodes.bin<br/>Node coordinates]
        EDGES[graph_edges.bin<br/>Graph topology + metadata]
    end

    %% Backend
    subgraph BACKEND [" 🖥️ bikemap/backend "]
        EXPRESS[Express.js Server<br/>Node.js runtime]

        subgraph ADDONS [" C++ N-API Addons "]
            KDSNAP[kd_snap.cpp<br/>Nearest node search<br/><em>mmap graph_nodes.bin</em>]
            ROUTE[route.cpp<br/>Shortest path algorithm<br/><em>mmap both bin files</em>]
        end

        subgraph ENDPOINTS [" API Endpoints "]
            SNAP_EP[GET /snap<br/>lat,lon → nearest node]
            ROUTE_EP[POST /route<br/>start,end,params → path]
            FILTER_EP[POST /filter<br/>update defaults]
        end
    end

    %% Frontend (placeholder)
    subgraph FRONTEND [" 🌐 bikemap/frontend "]
        UI[Web Interface<br/>Map + routing UI]
    end

    %% Flow connections - Ingestion
    OSM --> BUILD
    BUILD --> WAY
    BUILD --> NODE
    WAY --> WRITE
    NODE --> WRITE
    WRITE --> NODES
    WRITE --> EDGES

    %% Flow connections - Backend
    NODES --> KDSNAP
    NODES --> ROUTE
    EDGES --> ROUTE

    KDSNAP --> SNAP_EP
    ROUTE --> ROUTE_EP
    EXPRESS --> FILTER_EP

    %% Flow connections - API
    SNAP_EP --> UI
    ROUTE_EP --> UI
    FILTER_EP --> UI

    %% Styling
    classDef dataFile fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    classDef process fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef service fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px
    classDef api fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef cpp fill:#ffebee,stroke:#c62828,stroke-width:2px

    class OSM,NODES,EDGES dataFile
    class BUILD,WAY,NODE,WRITE process
    class EXPRESS,UI service
    class SNAP_EP,ROUTE_EP,FILTER_EP api
    class KDSNAP,ROUTE cpp
```
# binary file formats
```
graph_nodes.bin

┌─────────────────┬──────┬─────────────────────────────────┐
│ NodesHeader     │ 16B  │ File metadata                   │
├─────────────────┼──────┼─────────────────────────────────┤
│   magic[8]      │  8B  │ "MMAPNODE" identifier           │
│   numNodes      │  4B  │ Count of nodes (N)              │
│   reserved      │  4B  │ Padding                         │
├─────────────────┼──────┼─────────────────────────────────┤
│ NodeIDs         │ N*8B │ OSM node identifiers            │
│   id[0]         │  8B  │ uint64_t                        │
│   id[1]         │  8B  │ uint64_t                        │
│   ...           │ ...  │ ...                             │
│   id[N-1]       │  8B  │ uint64_t                        │
├─────────────────┼──────┼─────────────────────────────────┤
│ Latitudes       │ N*4B │ Coordinates (degrees)           │
│   lat[0]        │  4B  │ float32 (WGS84)                 │
│   lat[1]        │  4B  │ float32                         │
│   ...           │ ...  │ ...                             │
│   lat[N-1]      │  4B  │ float32                         │
├─────────────────┼──────┼─────────────────────────────────┤
│ Longitudes      │ N*4B │ Coordinates (degrees)           │
│   lon[0]        │  4B  │ float32 (WGS84)                 │
│   lon[1]        │  4B  │ float32                         │
│   ...           │ ...  │ ...                             │
│   lon[N-1]      │  4B  │ float32                         │
└─────────────────┴──────┴─────────────────────────────────┘
```
```
graph_edges.bin

Format: Compressed Sparse Row (CSR) adjacency list
Edge lookup: for node i, edges are neighbors[offset[i]:offset[i+1]]

┌─────────────────────┬────────┬─────────────────────────────────────────┐
│ EdgesHeader         │  20B   │ File metadata                           │
├─────────────────────┼────────┼─────────────────────────────────────────┤
│   magic[8]          │   8B   │ "MMAPEDGE" identifier                   │
│   numNodes          │   4B   │ Count of nodes                          │
│   numEdges          │   4B   │ Count of directed edges                 │
│   hasSurfacePrimary │   1B   │ Surface data present (1)                │
│   hasModeMask       │   1B   │ Mode data present (1)                   │
│   lengthType        │   1B   │ Length format (0=float32)               │
│   reserved          │   1B   │ Padding                                 │
├─────────────────────┼────────┼─────────────────────────────────────────┤
│ Array Sizes         │  20B   │ Defensive parsing metadata              │
│   offsetsSize       │   4B   │ uint32_t: offsets array length          │
│   neighborsSize     │   4B   │ uint32_t: neighbors array length        │
│   lengthsSize       │   4B   │ uint32_t: lengths array length          │
│   surfacePrimSize   │   4B   │ uint32_t: surface array length          │
│   modeMasksSize     │   4B   │ uint32_t: mode masks array length       │
├─────────────────────┼────────┼─────────────────────────────────────────┤
│ Offsets             │(N+1)*4B│ CSR adjacency list pointers             │
│   offset[0]         │   4B   │ uint32_t: start of node 0 edges         │
│   offset[1]         │   4B   │ uint32_t: start of node 1 edges         │
│   ...               │  ...   │ ...                                     │
│   offset[N]         │   4B   │ uint32_t: end marker                    │
├─────────────────────┼────────┼─────────────────────────────────────────┤
│ Neighbors           │ E*4B   │ Target node indices                     │
│   neighbor[0]       │   4B   │ uint32_t: target node index             │
│   neighbor[1]       │   4B   │ uint32_t: target node index             │
│   ...               │  ...   │ ...                                     │
│   neighbor[E-1]     │   4B   │ uint32_t: target node index             │
├─────────────────────┼────────┼─────────────────────────────────────────┤
│ Lengths             │ E*4B   │ Edge lengths in meters                  │
│   length[0]         │   4B   │ float32: distance in meters             │
│   length[1]         │   4B   │ float32: distance in meters             │
│   ...               │  ...   │ ...                                     │
│   length[E-1]       │   4B   │ float32: distance in meters             │
├─────────────────────┼────────┼─────────────────────────────────────────┤
│ Surface Primary     │ E*1B   │ Primary surface type                    │
│   surface[0]        │   1B   │ uint8_t: SurfacePrimary enum            │
│   surface[1]        │   1B   │ uint8_t: SurfacePrimary enum            │
│   ...               │  ...   │ ...                                     │
│   surface[E-1]      │   1B   │ uint8_t: SurfacePrimary enum            │
├─────────────────────┼────────┼─────────────────────────────────────────┤
│ Mode Masks          │ E*1B   │ Allowed transport modes                 │
│   mode[0]           │   1B   │ uint8_t: bike(1)|foot(2) flags          │
│   mode[1]           │   1B   │ uint8_t: bike(1)|foot(2) flags          │
│   ...               │  ...   │ ...                                     │
│   mode[E-1]         │   1B   │ uint8_t: bike(1)|foot(2) flags          │
└─────────────────────┴────────┴─────────────────────────────────────────┘
```