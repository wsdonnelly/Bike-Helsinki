// kd_snap.cpp — loads graph_nodes.bin (fixed layout) and builds a packed 2D KD-tree.
// Exports:
//   findNearest(lat, lon) -> idx
//   getNode(idx) -> { idx, lat, lon }
//   getLatArray() / getLonArray() -> zero-copy Float32Array views

#include <napi.h>

#include <algorithm>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <utility>
#include <vector>
#include <cmath>

// ---------------- graph_nodes.bin layout ---------------------------
// Header (16 bytes total):
//   magic[8]   : "MMAPNODE"
//   numNodes   : uint32_t (N)
//   reserved   : uint32_t (padding)
struct NodesHeader {
  char     magic[8];
  uint32_t numNodes;
  uint32_t reserved;
};
static_assert(sizeof(NodesHeader) == 16, "NodesHeader must be 16 bytes");

// ---------------- Raw in-memory storage ----------------------------
static std::vector<uint64_t> gOsmNodeIds;     // ids[N] (not exposed, but loaded)
static std::vector<float>    gLatitudeDegrees;  // lat[N] in degrees
static std::vector<float>    gLongitudeDegrees; // lon[N] in degrees

// ---------------- Packed KD-tree for 2D lat/lon --------------------
namespace kd2d {

enum class SplitAxis : uint8_t { Latitude = 0, Longitude = 1 };

struct KDNode {
  uint32_t pointIndex;  // index into gLatitudeDegrees/gLongitudeDegrees
  int32_t  leftChild;   // -1 if none
  int32_t  rightChild;  // -1 if none
  SplitAxis splitAxis;  // which coordinate this node splits on
};

class PackedKDTree {
 public:
  void build(const std::vector<float>& latitudeDegrees,
             const std::vector<float>& longitudeDegrees) {
    clear();
    const uint32_t totalPoints = static_cast<uint32_t>(latitudeDegrees.size());
    if (totalPoints == 0) return;

    pointIndexScratch.resize(totalPoints);
    for (uint32_t i = 0; i < totalPoints; ++i) pointIndexScratch[i] = i;

    rootNodeIndex = static_cast<int32_t>(
        buildRecursive(0, totalPoints, /*depth=*/0, latitudeDegrees, longitudeDegrees));
  }

  bool empty() const { return kdNodes.empty(); }

  // Returns original point index, or UINT32_MAX if empty.
  uint32_t nearestNeighbor(float queryLatitudeDegrees,
                           float queryLongitudeDegrees,
                           const std::vector<float>& latitudeDegrees,
                           const std::vector<float>& longitudeDegrees) const {
    if (empty()) return UINT32_MAX;

    const double kDegToRad = 3.14159265358979323846 / 180.0;
    const double cosQueryLatitude = std::cos(queryLatitudeDegrees * kDegToRad);

    uint32_t bestPointIndex = UINT32_MAX;
    double bestDistanceSquared = std::numeric_limits<double>::infinity();

    nearestRecursive(rootNodeIndex,
                     queryLatitudeDegrees,
                     queryLongitudeDegrees,
                     cosQueryLatitude,
                     latitudeDegrees,
                     longitudeDegrees,
                     bestPointIndex,
                     bestDistanceSquared);
    return bestPointIndex;
  }

 private:
  std::vector<KDNode>    kdNodes;
  std::vector<uint32_t>  pointIndexScratch; // used during build partitioning
  int32_t                rootNodeIndex = -1;

  void clear() {
    kdNodes.clear();
    pointIndexScratch.clear();
    rootNodeIndex = -1;
  }

  static inline double equirectangularDistanceSquared(double latA, double lonA,
                                                      double latB, double lonB,
                                                      double cosLatA) {
    const double deltaLat = latB - latA;
    const double deltaLonScaled = (lonB - lonA) * cosLatA;
    return deltaLat * deltaLat + deltaLonScaled * deltaLonScaled;
  }

  uint32_t buildRecursive(uint32_t startInclusive,
                          uint32_t endExclusive,
                          uint32_t treeDepth,
                          const std::vector<float>& latitudeDegrees,
                          const std::vector<float>& longitudeDegrees) {
    if (startInclusive >= endExclusive) return UINT32_MAX;

    const SplitAxis chosenAxis =
        (treeDepth & 1) ? SplitAxis::Longitude : SplitAxis::Latitude;

    const uint32_t medianIndex = (startInclusive + endExclusive) / 2;

    // Partition around median along the chosen axis.
    auto lessOnAxis = [&](uint32_t a, uint32_t b) {
      if (chosenAxis == SplitAxis::Latitude)
        return latitudeDegrees[a] < latitudeDegrees[b];
      else
        return longitudeDegrees[a] < longitudeDegrees[b];
    };
    std::nth_element(pointIndexScratch.begin() + startInclusive,
                     pointIndexScratch.begin() + medianIndex,
                     pointIndexScratch.begin() + endExclusive,
                     lessOnAxis);

    const uint32_t pointIndexAtNode = pointIndexScratch[medianIndex];

    // Build children first so their indices are known.
    int32_t leftChildIndex  = -1;
    int32_t rightChildIndex = -1;

    if (medianIndex > startInclusive) {
      leftChildIndex = static_cast<int32_t>(
          buildRecursive(startInclusive, medianIndex, treeDepth + 1,
                         latitudeDegrees, longitudeDegrees));
    }
    if (medianIndex + 1 < endExclusive) {
      rightChildIndex = static_cast<int32_t>(
          buildRecursive(medianIndex + 1, endExclusive, treeDepth + 1,
                         latitudeDegrees, longitudeDegrees));
    }

    const int32_t myNodeIndex = static_cast<int32_t>(kdNodes.size());
    kdNodes.push_back(KDNode{
        pointIndexAtNode,
        leftChildIndex,
        rightChildIndex,
        chosenAxis
    });
    return static_cast<uint32_t>(myNodeIndex);
  }

  void nearestRecursive(int32_t nodeIndex,
                        float queryLatitudeDegrees,
                        float queryLongitudeDegrees,
                        double cosQueryLatitude,
                        const std::vector<float>& latitudeDegrees,
                        const std::vector<float>& longitudeDegrees,
                        uint32_t& bestPointIndex,
                        double& bestDistanceSquared) const {
    if (nodeIndex < 0) return;

    const KDNode& node = kdNodes[static_cast<size_t>(nodeIndex)];
    const uint32_t nodePointIndex = node.pointIndex;

    // 1) Check the point at this node
    const double distanceSquared = equirectangularDistanceSquared(
        queryLatitudeDegrees, queryLongitudeDegrees,
        latitudeDegrees[nodePointIndex], longitudeDegrees[nodePointIndex],
        cosQueryLatitude);

    if (distanceSquared < bestDistanceSquared) {
      bestDistanceSquared = distanceSquared;
      bestPointIndex = nodePointIndex;
    }

    // 2) Decide which child to explore first (near side) and compute split delta^2
    int32_t nearChildIndex = node.leftChild;
    int32_t farChildIndex  = node.rightChild;
    double splitDeltaSquared;

    if (node.splitAxis == SplitAxis::Latitude) {
      const float splitLatitude = latitudeDegrees[nodePointIndex];
      const bool goLeftFirst = (queryLatitudeDegrees < splitLatitude);
      nearChildIndex = goLeftFirst ? node.leftChild : node.rightChild;
      farChildIndex  = goLeftFirst ? node.rightChild : node.leftChild;
      const double deltaLat = queryLatitudeDegrees - splitLatitude;
      splitDeltaSquared = deltaLat * deltaLat; // degrees^2
    } else {
      const float splitLongitude = longitudeDegrees[nodePointIndex];
      const bool goLeftFirst = (queryLongitudeDegrees < splitLongitude);
      nearChildIndex = goLeftFirst ? node.leftChild : node.rightChild;
      farChildIndex  = goLeftFirst ? node.rightChild : node.leftChild;
      const double deltaLonScaled = (queryLongitudeDegrees - splitLongitude) * cosQueryLatitude;
      splitDeltaSquared = deltaLonScaled * deltaLonScaled; // scaled degrees^2
    }

    // 3) Explore near side
    if (nearChildIndex >= 0) {
      nearestRecursive(nearChildIndex, queryLatitudeDegrees, queryLongitudeDegrees,
                       cosQueryLatitude, latitudeDegrees, longitudeDegrees,
                       bestPointIndex, bestDistanceSquared);
    }

    // 4) Explore far side only if it can contain a closer point
    if (farChildIndex >= 0 && splitDeltaSquared < bestDistanceSquared) {
      nearestRecursive(farChildIndex, queryLatitudeDegrees, queryLongitudeDegrees,
                       cosQueryLatitude, latitudeDegrees, longitudeDegrees,
                       bestPointIndex, bestDistanceSquared);
    }
  }
};

} // namespace kd2d

// Single global KD-tree instance
static kd2d::PackedKDTree gKdTree;

// ---------------- Loader for the exact binary layout ----------------
static bool loadFromGraphNodes(const std::string& filePath)
{
  std::ifstream input(filePath, std::ios::binary);
  if (!input) return false;

  NodesHeader header{};
  input.read(reinterpret_cast<char*>(&header), sizeof(header));
  if (!input) throw std::runtime_error("graph_nodes.bin: failed to read 16-byte header");

  if (std::memcmp(header.magic, "MMAPNODE", 8) != 0) {
    throw std::runtime_error("graph_nodes.bin: bad magic (expected \"MMAPNODE\")");
  }
  const uint32_t nodeCount = header.numNodes;

  // Read NodeIDs (N * uint64)
  gOsmNodeIds.resize(nodeCount);
  input.read(reinterpret_cast<char*>(gOsmNodeIds.data()),
             static_cast<std::streamsize>(sizeof(uint64_t)) * nodeCount);
  if (!input) throw std::runtime_error("graph_nodes.bin: truncated NodeIDs[]");

  // Read Latitudes (N * float)
  gLatitudeDegrees.resize(nodeCount);
  input.read(reinterpret_cast<char*>(gLatitudeDegrees.data()),
             static_cast<std::streamsize>(sizeof(float)) * nodeCount);
  if (!input) throw std::runtime_error("graph_nodes.bin: truncated lat[]");

  // Read Longitudes (N * float)
  gLongitudeDegrees.resize(nodeCount);
  input.read(reinterpret_cast<char*>(gLongitudeDegrees.data()),
             static_cast<std::streamsize>(sizeof(float)) * nodeCount);
  if (!input) throw std::runtime_error("graph_nodes.bin: truncated lon[]");

  // Build KD-tree
  gKdTree.build(gLatitudeDegrees, gLongitudeDegrees);
  return true;
}

// ---------------- N-API bindings -----------------------------------
Napi::Value findNearest(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected (lat:number, lon:number)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  if (gLatitudeDegrees.empty()) {
    Napi::Error::New(env, "KD-tree not loaded").ThrowAsJavaScriptException();
    return env.Null();
  }

  const float queryLatitudeDegrees  = static_cast<float>(info[0].As<Napi::Number>().DoubleValue());
  const float queryLongitudeDegrees = static_cast<float>(info[1].As<Napi::Number>().DoubleValue());

  const uint32_t nearestIndex = gKdTree.nearestNeighbor(
      queryLatitudeDegrees, queryLongitudeDegrees,
      gLatitudeDegrees, gLongitudeDegrees);

  if (nearestIndex == UINT32_MAX) {
    Napi::Error::New(env, "KD-tree is empty").ThrowAsJavaScriptException();
    return env.Null();
  }
  return Napi::Number::New(env, nearestIndex);
}

Napi::Value getNode(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();
  if (info.Length() != 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Expected (idx:number)").ThrowAsJavaScriptException();
    return env.Null();
  }
  const uint32_t pointIndex = info[0].As<Napi::Number>().Uint32Value();
  if (pointIndex >= gLatitudeDegrees.size()) {
    Napi::RangeError::New(env, "Index out of range").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object nodeObj = Napi::Object::New(env);
  nodeObj.Set("idx", Napi::Number::New(env, pointIndex));
  nodeObj.Set("lat", Napi::Number::New(env, gLatitudeDegrees[pointIndex]));
  nodeObj.Set("lon", Napi::Number::New(env, gLongitudeDegrees[pointIndex]));
  // If you want to expose OSM id too:
  // nodeObj.Set("id", Napi::BigInt::New(env, gOsmNodeIds[pointIndex]));
  return nodeObj;
}

Napi::Value GetLatArray(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();
  if (gLatitudeDegrees.empty()) return Napi::Float32Array::New(env, 0);

  Napi::ArrayBuffer backingBuffer = Napi::ArrayBuffer::New(
      env,
      static_cast<void*>(gLatitudeDegrees.data()),
      gLatitudeDegrees.size() * sizeof(float),
      [](Napi::Env, void*) {}); // no-op finalizer: we keep ownership

  return Napi::Float32Array::New(env, gLatitudeDegrees.size(), backingBuffer, 0);
}

Napi::Value GetLonArray(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();
  if (gLongitudeDegrees.empty()) return Napi::Float32Array::New(env, 0);

  Napi::ArrayBuffer backingBuffer = Napi::ArrayBuffer::New(
      env,
      static_cast<void*>(gLongitudeDegrees.data()),
      gLongitudeDegrees.size() * sizeof(float),
      [](Napi::Env, void*) {});

  return Napi::Float32Array::New(env, gLongitudeDegrees.size(), backingBuffer, 0);
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  try {
    if (!loadFromGraphNodes("data/graph_nodes.bin")) {
      std::cerr << "[kd_snap] graph_nodes.bin missing\n";
    }
  } catch (const std::exception& e) {
    Napi::Error::New(env, std::string("[kd_snap] load failed: ") + e.what())
        .ThrowAsJavaScriptException();
    return exports;
  }

  exports.Set("findNearest", Napi::Function::New(env, findNearest));
  exports.Set("getNode", Napi::Function::New(env, getNode));
  exports.Set("getLatArray", Napi::Function::New(env, GetLatArray));
  exports.Set("getLonArray", Napi::Function::New(env, GetLonArray));
  return exports;
}

NODE_API_MODULE(kd_snap, Init)
