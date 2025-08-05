![](./demo_1.gif)
![](./demo_2.gif)

# Injest
## data formats
graph_nodes.bin
- [uint32 numNodes] [for i in 0..numNodes-1: uint64 nodeId_i][float32 lat_i][float32 lon_i]

graph_edges.bin
- Format: [uint32 numNodes][uint32 numEdges] [ offsets[0..numNodes] (uint32 each) ] neighbors[0..numEdges-1] (uint32) ] [ weights[0..numEdges-1] (float32) ] [ surfaces[0..numEdges-1] (SurfaceTypes (uint8_t)) ]

/*
graph_nodes.bin format: [uint32 numNodes] [for i in 0..numNodes-1: uint64
nodeId_i][float32 lat_i][float32 lon_i]

graph_edges.bin format: [uint32 numNodeIds][uint32 edgeCount] [
offsets[0..numNodeIds] (uint32 each) ] neighbors[0..edgeCount-1] (uint32) ] [
weights[0..edgeCount-1] (float32) ]
*/

# Backend
# Frontend