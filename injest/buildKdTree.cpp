#include <cstdint>
#include <fstream>
#include <iostream>
#include <vector>

// Simple on-disk format: [uint32 numNodes] [ float32 lat_0, float32 lon_0,
// uint32 idx_0 ] … repeated

int main()
{
  std::ifstream in("../../data/graph_nodes.bin", std::ios::binary);
  if (!in)
  {
    std::cerr << "Error: graph_nodes.bin not found\n";
    return 1;
  }

  uint32_t numNodes;
  in.read(reinterpret_cast<char*>(&numNodes), sizeof(numNodes));
  if (!in)
  {
    std::cerr << "Error: failed to read node count\n";
    return 1;
  }

  struct KdEntry
  {
    float lat;
    float lon;
    uint32_t idx;
  };

  std::vector<KdEntry> kdData;
  kdData.reserve(numNodes);
  for (uint32_t i{0}; i < numNodes; ++i)
  {
    uint64_t nodeId;
    float lat, lon;
    in.read(reinterpret_cast<char*>(&nodeId), sizeof(nodeId))
        .read(reinterpret_cast<char*>(&lat), sizeof(lat))
        .read(reinterpret_cast<char*>(&lon), sizeof(lon));
    if (!in)
    {
      std::cerr << "Corrupt record at " << i << "\n";
      return 1;
    }
    kdData.push_back({lat, lon, i});
  }
  in.close();

  std::ofstream out("../../data/kd_nodes.bin", std::ios::binary);
  if (!out)
  {
    std::cerr << "Cannot open kd_nodes.bin\n";
    return 1;
  }
  out.write(reinterpret_cast<const char*>(&numNodes), sizeof(numNodes));
  for (auto& [lat, lon, idx] : kdData)
  {
    out.write(reinterpret_cast<const char*>(&lat), sizeof(lat))
        .write(reinterpret_cast<const char*>(&lon), sizeof(lon))
        .write(reinterpret_cast<const char*>(&idx), sizeof(idx));
    if (!out)
    {
      std::cerr << "Write error\n";
      return 1;
    }
  }
  out.close();
  std::cout << "Wrote kd_nodes.bin (" << numNodes << " nodes)\n";
  return 0;
}
