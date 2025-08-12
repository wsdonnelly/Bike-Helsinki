![](./demo_1.gif)
![](./demo_2.gif)
![](./buildgraph_diagram.svg)

# Injest
flowchart TB
    A[OSM PBF] --> B[WayCollector<br/>• pick bike/foot-relevant ways<br/>• read tags: highway, access, bicycle, foot,<br/>  oneway, oneway:bicycle, cycleway, surface<br/>• compute WayMeta:<br/>  - bike_fwd/back, foot_fwd/back<br/>  - surface_primary, surface_flags]
    A --> C[NodeCollector<br/>• collect coords only for used node IDs]

    B --> D[Build ID mapping<br/>• allNodeIds (sorted)<br/>• nodeId → idx (0..N-1)]
    C --> D

    D --> E[Count directed edges<br/>• for each consecutive pair in way:<br/>  - if (bike_fwd || foot_fwd) ++deg[u]<br/>  - if (bike_back || foot_back) ++deg[v]<br/>• prefix-sum → offsets (CSR)]

    E --> F[Fill CSR arrays (size E)<br/>• neighbors, length_m (haversine)<br/>• surface_flags (u16), surface_primary (u8)<br/>• mode_mask (u8: bit0=BIKE, bit1=FOOT)<br/>• write both directions as permitted]

    F --> G[[graph_nodes.bin]]
    F --> H[[graph_edges.bin]]

flowchart TB
    subgraph N[graph_nodes.bin]
      nh[NodesHeader (20B)<br/>magic "MMAPNODE"<br/>version u32=1<br/>num_nodes u32=N<br/>coord_type u8=0 (float32 deg)<br/>reserved[3]]
      nids[ids[N] • u64 each]
      nlat[lat[N] • float32 deg]
      nlon[lon[N] • float32 deg]
    end

    subgraph E[graph_edges.bin]
      eh[EdgesHeader (24B)<br/>magic "MMAPEDGE"<br/>version u32=1<br/>num_nodes u32=N<br/>num_edges u32=E<br/>has_surface_primary=1<br/>has_surface_flags=1<br/>has_mode_mask=1<br/>length_type=0 (float32 m)]
      elens[Lengths block (6×u32)<br/>L_off=N+1, L_nei=E, L_len=E,<br/>L_fl=E, L_pri=E, L_mm=E]
      off[offsets[L_off] • u32<br/>CSR: offsets[0]=0, offsets[N]=E]
      nei[neighbors[L_nei] • u32 (node idx)]
      len[length_m[L_len] • float32 (meters)]
      sfl[surface_flags[L_fl] • u16 (bitmask)]
      spr[surface_primary[L_pri] • u8 (enum)]
      mm[mode_mask[L_mm] • u8 (bits)]
    end

    mm --> L1[mode_mask bits:<br/>bit0 (0x01): BIKE allowed<br/>bit1 (0x02): FOOT allowed]
    sfl --> L2[surface_flags:<br/>bitset from SurfaceTypes.hpp<br/>(e.g., PAVED/GRAVEL/etc.)]
    spr --> L3[surface_primary:<br/>compact enum bucket<br/>(ASPHALT/CONCRETE/GRAVEL/…)]


## data formats


# Backend
# Frontend