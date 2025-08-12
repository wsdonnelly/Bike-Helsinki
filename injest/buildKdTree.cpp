#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <vector>

namespace nodes_blob
{

// Must match your writer in buildGraph.cpp
struct NodesHeader
{
  char magic[8];        // "MMAPNODE"
  uint32_t version;     // = 1
  uint32_t num_nodes;   // N
  uint8_t coord_type;   // 0=float32 degrees, 1=int32 microdegrees
  uint8_t reserved[3];  // zero
};
static_assert(sizeof(NodesHeader) == 20, "NodesHeader must be 20 bytes");

enum CoordType : uint8_t
{
  DegreesF32 = 0,
  MicrodegI32 = 1
};

}  // namespace nodes_blob

struct KdEntry
{
  float lat_deg;
  float lon_deg;
  uint32_t idx;  // internal node index (0..N-1)
};

int main()
{
  std::ifstream in("../../data/graph_nodes.bin", std::ios::binary);
  if (!in)
  {
    std::cerr << "Error: graph_nodes.bin not found\n";
    return 1;
  }

  // Peek first 8 bytes to see if we have the new header magic.
  char magic[8] = {};
  in.read(reinterpret_cast<char*>(&magic[0]), sizeof(magic));
  if (!in)
  {
    std::cerr << "Error: unable to read graph_nodes.bin\n";
    return 1;
  }
  in.seekg(0, std::ios::beg);

  uint32_t numNodes = 0;
  std::vector<KdEntry> kdData;

  if (std::memcmp(magic, "MMAPNODE", 8) == 0)
  {
    // ---- New format with header and arrays ----
    nodes_blob::NodesHeader hdr{};
    in.read(reinterpret_cast<char*>(&hdr), sizeof(hdr));
    if (!in)
    {
      std::cerr << "Error: failed to read NodesHeader\n";
      return 1;
    }
    if (std::memcmp(hdr.magic, "MMAPNODE", 8) != 0 || hdr.version != 1)
    {
      std::cerr << "Error: unsupported nodes blob (bad magic/version)\n";
      return 1;
    }

    numNodes = hdr.num_nodes;

    // Read node IDs (we don't need them for KD, but we must advance the stream)
    std::vector<uint64_t> node_ids(numNodes);
    in.read(reinterpret_cast<char*>(node_ids.data()),
            sizeof(uint64_t) * numNodes);
    if (!in)
    {
      std::cerr << "Error: failed reading node_ids\n";
      return 1;
    }

    kdData.reserve(numNodes);

    if (hdr.coord_type == nodes_blob::DegreesF32)
    {
      // float32 degrees
      std::vector<float> lat(numNodes), lon(numNodes);
      in.read(reinterpret_cast<char*>(lat.data()), sizeof(float) * numNodes);
      if (!in)
      {
        std::cerr << "Error: failed reading lat[]\n";
        return 1;
      }
      in.read(reinterpret_cast<char*>(lon.data()), sizeof(float) * numNodes);
      if (!in)
      {
        std::cerr << "Error: failed reading lon[]\n";
        return 1;
      }

      for (uint32_t i = 0; i < numNodes; ++i)
      {
        kdData.push_back(KdEntry{lat[i], lon[i], i});
      }
    } else if (hdr.coord_type == nodes_blob::MicrodegI32)
    {
      // int32 microdegrees -> convert to float degrees
      std::vector<int32_t> lat_u(numNodes), lon_u(numNodes);
      in.read(reinterpret_cast<char*>(lat_u.data()),
              sizeof(int32_t) * numNodes);
      if (!in)
      {
        std::cerr << "Error: failed reading lat_microdeg[]\n";
        return 1;
      }
      in.read(reinterpret_cast<char*>(lon_u.data()),
              sizeof(int32_t) * numNodes);
      if (!in)
      {
        std::cerr << "Error: failed reading lon_microdeg[]\n";
        return 1;
      }

      constexpr double kScale = 1.0 / 1'000'000.0;
      kdData.reserve(numNodes);
      for (uint32_t i = 0; i < numNodes; ++i)
      {
        float lat = static_cast<float>(static_cast<double>(lat_u[i]) * kScale);
        float lon = static_cast<float>(static_cast<double>(lon_u[i]) * kScale);
        kdData.push_back(KdEntry{lat, lon, i});
      }
    } else
    {
      std::cerr << "Error: unknown coord_type " << int(hdr.coord_type) << "\n";
      return 1;
    }

  } else
  {
    // ---- Legacy fallback (your original simple format) ----
    // [uint32 numNodes] followed by N * (uint64 id, float lat, float lon)
    in.read(reinterpret_cast<char*>(&numNodes), sizeof(numNodes));
    if (!in)
    {
      std::cerr << "Error: failed to read legacy node count\n";
      return 1;
    }

    kdData.reserve(numNodes);
    for (uint32_t i = 0; i < numNodes; ++i)
    {
      uint64_t nodeId;
      float lat, lon;
      in.read(reinterpret_cast<char*>(&nodeId), sizeof(nodeId))
          .read(reinterpret_cast<char*>(&lat), sizeof(lat))
          .read(reinterpret_cast<char*>(&lon), sizeof(lon));
      if (!in)
      {
        std::cerr << "Legacy read error at record " << i << "\n";
        return 1;
      }
      kdData.push_back(KdEntry{lat, lon, i});
    }
  }

  in.close();

  // ---- Write kd_nodes.bin in the same simple format you used before ----
  std::ofstream out("../../data/kd_nodes.bin", std::ios::binary);
  if (!out)
  {
    std::cerr << "Cannot open kd_nodes.bin for write\n";
    return 1;
  }

  out.write(reinterpret_cast<const char*>(&numNodes), sizeof(numNodes));
  for (const auto& e : kdData)
  {
    out.write(reinterpret_cast<const char*>(&e.lat_deg), sizeof(e.lat_deg))
        .write(reinterpret_cast<const char*>(&e.lon_deg), sizeof(e.lon_deg))
        .write(reinterpret_cast<const char*>(&e.idx), sizeof(e.idx));
    if (!out)
    {
      std::cerr << "Write error while writing kd_nodes.bin\n";
      return 1;
    }
  }
  out.close();

  std::cout << "Wrote kd_nodes.bin (" << numNodes << " nodes)\n";
  return 0;
}
