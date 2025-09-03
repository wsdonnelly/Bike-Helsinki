// route.cpp — N-API addon: mmap + CSR A* with ride/walk layers & mode
// switching. Build with your binding.gyp using node-addon-api (C++17+).

#include <fcntl.h>
#include <napi.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <limits>
#include <memory>
#include <optional>
#include <queue>
#include <stdexcept>
#include <string>
#include <system_error>
#include <utility>
#include <vector>

#include "utils.hpp"

// ---------------- Blob headers (match your ingest/writer) ----------------
namespace blob
{

struct NodesHeader
{
  char magic[8];        // "MMAPNODE"
  uint32_t version;     // = 1
  uint32_t numNodes;    // N
  uint8_t coordType;    // 0=float32 degrees, 1=int32 microdegrees
  uint8_t reserved[3];  // zero
};
static_assert(sizeof(NodesHeader) == 20, "NodesHeader must be 20 bytes");

struct EdgesHeader
{
  char magic[8];              // "MMAPGRPH"
  uint32_t version;           // = 1
  uint32_t numNodes;          // N
  uint32_t numEdges;          // E (directed)
  uint8_t hasSurfacePrimary;  // =1
  uint8_t hasSurfaceFlags;    // =1
  uint8_t hasModeMask;        // =1
  uint8_t lengthType;         // 0=float32 meters
};
static_assert(sizeof(EdgesHeader) == 24, "EdgesHeader must be 24 bytes");

enum CoordType : uint8_t
{
  DegreesF32 = 0,
  MicrodegI32 = 1
};

}  // namespace blob

// ---------------- mmap helpers ----------------
// 1) Make the mapping handle move-only
struct MappedFile
{
  void* base = nullptr;
  size_t size = 0;
  int fileHandle = -1;

  MappedFile() = default;
  MappedFile(const MappedFile&) = delete;
  MappedFile& operator=(const MappedFile&) = delete;

  MappedFile(MappedFile&& other) noexcept
      : base(std::exchange(other.base, nullptr)),
        size(std::exchange(other.size, 0)),
        fileHandle(std::exchange(other.fileHandle, -1))
  {}

  MappedFile& operator=(MappedFile&& other) noexcept
  {
    if (this != &other)
    {
      if (base) ::munmap(base, size);
      if (fileHandle >= 0) ::close(fileHandle);
      base = std::exchange(other.base, nullptr);
      size = std::exchange(other.size, 0);
      fileHandle = std::exchange(other.fileHandle, -1);
    }
    return *this;
  }

  ~MappedFile()
  {
    if (base) ::munmap(base, size);
    if (fileHandle >= 0) ::close(fileHandle);
  }
};

// 2) Return a shared_ptr directly (no by-value temporary)
static std::shared_ptr<MappedFile> mapReadonlySp(const std::string& filePath)
{
  auto mapping = std::make_shared<MappedFile>();

  const int fileHandle = ::open(filePath.c_str(), O_RDONLY | O_CLOEXEC);
  if (fileHandle < 0)
  {
    throw std::system_error(errno, std::generic_category(),
                            "open failed: " + filePath);
  }
  mapping->fileHandle = fileHandle;

  struct stat fileStat{};
  if (::fstat(fileHandle, &fileStat) != 0)
  {
    ::close(fileHandle);
    mapping->fileHandle = -1;
    throw std::system_error(errno, std::generic_category(),
                            "fstat failed: " + filePath);
  }

  mapping->size = static_cast<size_t>(fileStat.st_size);
  if (mapping->size == 0)
  {
    // You can choose to allow empty files; here we treat it as an error.
    ::close(fileHandle);
    mapping->fileHandle = -1;
    throw std::runtime_error("mmap failed: file is empty: " + filePath);
  }

  void* mappedAddress =
      ::mmap(nullptr, mapping->size, PROT_READ, MAP_PRIVATE, fileHandle, 0);
  if (mappedAddress == MAP_FAILED)
  {
    ::close(fileHandle);
    mapping->fileHandle = -1;
    throw std::system_error(errno, std::generic_category(),
                            "mmap failed: " + filePath);
  }

  mapping->base = mappedAddress;
  return mapping;
}

// ---------------- Typed views over the blobs ----------------
struct NodesView
{
  std::shared_ptr<MappedFile> hold;  // keep mapping alive
  uint32_t numNodes{0};
  const uint64_t* ids{nullptr};
  const float* lat_f32{nullptr};  // if coordType==0
  const float* lon_f32{nullptr};
  const int32_t* lat_i32{nullptr};  // if coordType==1 (microdegrees)
  const int32_t* lon_i32{nullptr};
  blob::CoordType coord{blob::DegreesF32};
};

struct EdgesView
{
  std::shared_ptr<MappedFile> hold;  // keep mapping alive
  uint32_t numNodes{0};
  uint32_t numEdges{0};
  const uint32_t* offsets{nullptr};        // N+1
  const uint32_t* neighbors{nullptr};      // E
  const float* lengthsMeters{nullptr};     // E
  const uint16_t* surfaceFlags{nullptr};   // E
  const uint8_t* surfacePrimary{nullptr};  // E
  const uint8_t* modeMask{nullptr};        // E (bit0=BIKE, bit1=FOOT)
};

static NodesView loadNodes(const std::string& filePath)
{
  auto mapping = mapReadonlySp(filePath);
  const char* cursor = static_cast<const char*>(mapping->base);
  const char* endPtr = cursor + mapping->size;

  auto requireBytes = [&](size_t bytes) {
    if (cursor + bytes > endPtr)
    {
      throw std::runtime_error("nodes blob truncated");
    }
  };

  // Header
  requireBytes(sizeof(blob::NodesHeader));
  const auto* header = reinterpret_cast<const blob::NodesHeader*>(cursor);
  if (std::memcmp(header->magic, "MMAPNODE", 8) != 0 || header->version != 1)
  {
    throw std::runtime_error("bad nodes header");
  }
  cursor += sizeof(*header);

  NodesView nodesView;
  nodesView.hold = mapping;
  nodesView.numNodes = header->numNodes;
  nodesView.coord = static_cast<blob::CoordType>(header->coordType);

  // IDs
  requireBytes(sizeof(uint64_t) * nodesView.numNodes);
  nodesView.ids = reinterpret_cast<const uint64_t*>(cursor);
  cursor += sizeof(uint64_t) * nodesView.numNodes;

  // Coordinates (layout depends on coordType)
  if (nodesView.coord == blob::DegreesF32)
  {
    requireBytes(sizeof(float) * nodesView.numNodes * 2);
    nodesView.lat_f32 = reinterpret_cast<const float*>(cursor);
    cursor += sizeof(float) * nodesView.numNodes;
    nodesView.lon_f32 = reinterpret_cast<const float*>(cursor);
    cursor += sizeof(float) * nodesView.numNodes;
  }
  else
  {
    requireBytes(sizeof(int32_t) * nodesView.numNodes * 2);
    nodesView.lat_i32 = reinterpret_cast<const int32_t*>(cursor);
    cursor += sizeof(int32_t) * nodesView.numNodes;
    nodesView.lon_i32 = reinterpret_cast<const int32_t*>(cursor);
    cursor += sizeof(int32_t) * nodesView.numNodes;
  }

  return nodesView;
}

static EdgesView loadEdges(const std::string& filePath)
{
  auto mapping = mapReadonlySp(filePath);
  const char* cursor = static_cast<const char*>(mapping->base);
  const char* endPtr = cursor + mapping->size;

  auto requireBytes = [&](size_t bytes) {
    if (cursor + bytes > endPtr)
    {
      throw std::runtime_error("edges blob truncated: " + filePath);
    }
  };

  // --- Header ---
  requireBytes(sizeof(blob::EdgesHeader));
  const auto* header = reinterpret_cast<const blob::EdgesHeader*>(cursor);

  // accept both
  const bool okMagic = (std::memcmp(header->magic, "MMAPGRPH", 8) == 0) ||
                       (std::memcmp(header->magic, "MMAPEDGE", 8) == 0);
  if (!okMagic || header->version != 1)
  {
    throw std::runtime_error("bad edges header: " + filePath);
  }
  if (header->lengthType != 0)
  {
    throw std::runtime_error(
        "unsupported lengthType (expected float32 meters): " + filePath);
  }
  cursor += sizeof(*header);

  // --- Lengths block (6×u32) ---
  requireBytes(6 * sizeof(uint32_t));
  uint32_t offsetsCount, neighborsCount, lengthCount, flagsCount, primaryCount,
      modeMaskCount;

  std::memcpy(&offsetsCount, cursor, 4);
  cursor += 4;
  std::memcpy(&neighborsCount, cursor, 4);
  cursor += 4;
  std::memcpy(&lengthCount, cursor, 4);
  cursor += 4;
  std::memcpy(&flagsCount, cursor, 4);
  cursor += 4;
  std::memcpy(&primaryCount, cursor, 4);
  cursor += 4;
  std::memcpy(&modeMaskCount, cursor, 4);
  cursor += 4;

  // Basic consistency
  if (offsetsCount != header->numNodes + 1 ||
      neighborsCount != header->numEdges || lengthCount != header->numEdges)
  {
    throw std::runtime_error("lengths block mismatch: " + filePath);
  }
  if (header->hasSurfaceFlags && flagsCount != header->numEdges)
  {
    throw std::runtime_error("flags length mismatch: " + filePath);
  }
  if (header->hasSurfacePrimary && primaryCount != header->numEdges)
  {
    throw std::runtime_error("primary length mismatch: " + filePath);
  }
  if (header->hasModeMask && modeMaskCount != header->numEdges)
  {
    throw std::runtime_error("modeMask length mismatch: " + filePath);
  }

  // --- Views ---
  EdgesView edgesView;
  edgesView.hold = mapping;
  edgesView.numNodes = header->numNodes;
  edgesView.numEdges = header->numEdges;

  requireBytes(sizeof(uint32_t) * offsetsCount);
  edgesView.offsets = reinterpret_cast<const uint32_t*>(cursor);
  cursor += sizeof(uint32_t) * offsetsCount;

  requireBytes(sizeof(uint32_t) * neighborsCount);
  edgesView.neighbors = reinterpret_cast<const uint32_t*>(cursor);
  cursor += sizeof(uint32_t) * neighborsCount;

  requireBytes(sizeof(float) * lengthCount);
  edgesView.lengthsMeters = reinterpret_cast<const float*>(cursor);
  cursor += sizeof(float) * lengthCount;

  if (header->hasSurfaceFlags)
  {
    requireBytes(sizeof(uint16_t) * flagsCount);
    edgesView.surfaceFlags = reinterpret_cast<const uint16_t*>(cursor);
    cursor += sizeof(uint16_t) * flagsCount;
  }

  if (header->hasSurfacePrimary)
  {
    requireBytes(sizeof(uint8_t) * primaryCount);
    edgesView.surfacePrimary = reinterpret_cast<const uint8_t*>(cursor);
    cursor += sizeof(uint8_t) * primaryCount;
  }

  if (header->hasModeMask)
  {
    requireBytes(sizeof(uint8_t) * modeMaskCount);
    edgesView.modeMask = reinterpret_cast<const uint8_t*>(cursor);
    cursor += sizeof(uint8_t) * modeMaskCount;
  }

  // Required fields sanity
  if (!edgesView.modeMask)
  {
    throw std::runtime_error("edges blob missing modeMask: " + filePath);
  }

  if (edgesView.offsets[0] != 0 ||
      edgesView.offsets[edgesView.numNodes] != edgesView.numEdges)
  {
    throw std::runtime_error("bad CSR offsets: " + filePath);
  }

  return edgesView;
}

// ---------------- Utilities ----------------
// possibly move to .hpp
static inline void nodeDeg(const NodesView& nodeView, uint32_t idx,
                           double& latDeg, double& lonDeg)
{
  if (nodeView.coord == blob::DegreesF32)
  {
    latDeg = static_cast<double>(nodeView.lat_f32[idx]);
    lonDeg = static_cast<double>(nodeView.lon_f32[idx]);
  }
  else
  {
    latDeg = static_cast<double>(nodeView.lat_i32[idx]) * 1e-6;
    lonDeg = static_cast<double>(nodeView.lon_i32[idx]) * 1e-6;
  }
}

// ---------------- Two-mode A* over CSR ----------------
enum : uint8_t
{
  MODE_BIKE = 0x1,
  MODE_FOOT = 0x2
};

enum class Layer : uint8_t
{
  Ride = 0,
  Walk = 1
};

struct AStarParams
{
  // Filtering
  uint16_t bikeSurfaceMask = 0xFFFF;

  // Speeds (meters/sec)
  double bikeSpeedMps = 6.0;  // ~21.6 km/h
  double walkSpeedMps = 1.5;  // ~5.4 km/h

  // Penalties (seconds) to switch modes at a node
  double ride_to_walk_penalty_s = 5.0;  // dismount
  double walkToRidePenaltyS = 3.0;      // remount

  // Per-surface primary multipliers (index by uint8 surfacePrimary)
  // unused now but can be used to make custom surface factors /speeds based on
  // user bike eg road, mountain, gravel etc.
  // If empty, all factors default to 1.0
  std::vector<double> bikeSurfaceFactor;
  std::vector<double> walkSurfaceFactor;
};

struct AStarResult
{
  bool success{false};
  // node by IDX rename perhaps?
  std::vector<uint32_t> pathNodes;  // node indices s..t
  std::vector<uint8_t> pathModes;   // MODE_* for each step between nodes;
                                    // length = pathNodes.size()-1
  double distanceM{0.0};
  double durationS{0.0};
  // new feature precentage
  double distanceBike{0.0};
  // std::vector<double> distanceBike(16, 0.0);
  double distanceWalk{0.0};
};

// Get factor by surface primary index; fall back to 1.0 if missing/invalid.
static inline double surfaceFactor(const std::vector<double>& factors,
                                   uint8_t surfacePrimaryIdx)
{
  constexpr double kDefaultFactor{1.0};

  if (factors.empty()) return kDefaultFactor;

  const size_t idx = static_cast<size_t>(surfacePrimaryIdx);
  if (idx >= factors.size()) return kDefaultFactor;

  const double factor = factors[idx];
  // Guard against NaN/Inf/<=0 coming from user input.
  if (!std::isfinite(factor) || factor <= 0.0) return kDefaultFactor;
  return factor;
}

struct PQItem
{
  // g(n) exact
  // h(n) heuristic
  // f(n) = g(n) + h(n): the estimated total trip time if you go through n
  // PQ pops smallest priorityF
  double priorityF;  // f = g + h
  uint32_t nodeIdx;  // graph node
  Layer layer;       // Ride/Walk
  bool operator<(const PQItem& rhs) const { return priorityF > rhs.priorityF; }
};

// keep inside struct to expand later if needed
struct StateKey
{
  static constexpr uint32_t kLayers{2};
  static inline uint32_t idx(uint32_t nodeIdx, Layer layer) noexcept
  {
    return nodeIdx * kLayers + static_cast<uint32_t>(layer);
  }
};

// Core A* (goal: reach node t in either layer with min time)
// remove passed edges/nodes since they are global ? no keep since pass to other
// functions maybe is clearer?
static AStarResult aStarTwoLayer(const EdgesView& edgesView,
                                 const NodesView& nodesView, uint32_t sourceIdx,
                                 uint32_t targetIdx, const AStarParams& params)
{
  const uint32_t numNodes = edgesView.numNodes;
  if (sourceIdx >= numNodes || targetIdx >= numNodes)
  {
    throw std::runtime_error("source/target out of range");
  }

  // Heuristic uses the *fastest* mode speed to remain admissible across layers.
  double targetLat, targetLon;
  nodeDeg(nodesView, targetIdx, targetLat, targetLon);
  const double vmax = std::max(params.bikeSpeedMps, params.walkSpeedMps);

  auto heuristic = [&](uint32_t currentIdx) -> double {
    double currentLat, currentLon;
    nodeDeg(nodesView, currentIdx, currentLat, currentLon);
    // optimistic
    return utils::haversineMeters(currentLat, currentLon, targetLat, targetLon) / vmax;
  };

  const double INF = std::numeric_limits<double>::infinity();
  const uint32_t S_ride = StateKey::idx(sourceIdx, Layer::Ride);
  const uint32_t S_walk = StateKey::idx(sourceIdx, Layer::Walk);

  // We allow starting in either layer with zero cost.
  std::vector<double> gScore(2 * numNodes, INF);
  // parent state index
  std::vector<uint32_t> parent(2 * numNodes, UINT32_MAX);
  // MODE_* used to move from parent to this (0 if mode-switch at same node)
  std::vector<uint8_t> parentStepMode(2 * numNodes, 0);

  gScore[S_ride] = 0.0;
  gScore[S_walk] = 0.0;

  std::priority_queue<PQItem> openPQ;
  openPQ.push(
      PQItem{gScore[S_ride] + heuristic(sourceIdx), sourceIdx, Layer::Ride});
  openPQ.push(
      PQItem{gScore[S_walk] + heuristic(sourceIdx), sourceIdx, Layer::Walk});

  std::vector<char> closed(2 * numNodes, 0);

  auto relaxEdge = [&](uint32_t u, Layer layerU, uint32_t v, double edgeTimeSec,
                       uint8_t edgeModeBit) {
    const uint32_t curIdx = StateKey::idx(u, layerU);
    // same layer (movement)
    const uint32_t nextIdx = StateKey::idx(v, layerU);
    const double tentative = gScore[curIdx] + edgeTimeSec;
    if (tentative < gScore[nextIdx])
    {
      gScore[nextIdx] = tentative;
      parent[nextIdx] = curIdx;
      parentStepMode[nextIdx] = edgeModeBit;
      openPQ.push(PQItem{tentative + heuristic(v), v, layerU});
    }
  };

  auto relaxSwitch = [&](uint32_t u, Layer from, Layer to, double penaltySec) {
    const uint32_t fromIdx = StateKey::idx(u, from);
    const uint32_t toIdx = StateKey::idx(u, to);
    const double tentative = gScore[fromIdx] + penaltySec;
    if (tentative < gScore[toIdx])
    {
      gScore[toIdx] = tentative;
      parent[toIdx] = fromIdx;
      // mode switch at same node
      parentStepMode[toIdx] = 0;
      openPQ.push(PQItem{tentative + heuristic(u), u, to});
    }
  };

  uint32_t goalState = UINT32_MAX;

  while (!openPQ.empty())
  {
    PQItem it = openPQ.top();
    openPQ.pop();
    const uint32_t u = it.nodeIdx;
    const Layer layer = it.layer;
    const uint32_t uIdx = StateKey::idx(u, layer);
    if (closed[uIdx]) continue;
    closed[uIdx] = 1;

    // Goal test: first time we pop t in any layer, we have the optimal arrival.
    if (u == targetIdx)
    {
      goalState = uIdx;
      break;
    }

    const uint32_t begin = edgesView.offsets[u];
    const uint32_t end = edgesView.offsets[u + 1];

    if (layer == Layer::Ride)
    {
      // Movement on ride-allowed edges and allowed bike surfaces
      for (uint32_t edgeIdx{begin}; edgeIdx < end; ++edgeIdx)
      {
        if ((edgesView.modeMask[edgeIdx] & MODE_BIKE) == 0) continue;
        if (edgesView.surfaceFlags &&
            (params.bikeSurfaceMask & edgesView.surfaceFlags[edgeIdx]) == 0)
          continue;
        const uint32_t v = edgesView.neighbors[edgeIdx];
        const double len =
            static_cast<double>(edgesView.lengthsMeters[edgeIdx]);
        const double factor =
            edgesView.surfacePrimary
                ? surfaceFactor(params.bikeSurfaceFactor,
                                edgesView.surfacePrimary[edgeIdx])
                : 1.0;
        // seconds
        const double edgeTimeSec = (len / params.bikeSpeedMps) * factor;
        relaxEdge(u, layer, v, edgeTimeSec, MODE_BIKE);
      }
      // Mode switch: Ride -> Walk
      if (params.ride_to_walk_penalty_s >= 0.0)
      {
        relaxSwitch(u, Layer::Ride, Layer::Walk, params.ride_to_walk_penalty_s);
      }
    }
    else
    {
      // Movement on foot-allowed edges and allowed walk surfaces
      for (uint32_t edgeIdx{begin}; edgeIdx < end; ++edgeIdx)
      {
        if ((edgesView.modeMask[edgeIdx] & MODE_FOOT) == 0) continue;
        if (edgesView.surfaceFlags && edgesView.surfaceFlags[edgeIdx] == 0)
          continue;
        const uint32_t v = edgesView.neighbors[edgeIdx];
        const double len =
            static_cast<double>(edgesView.lengthsMeters[edgeIdx]);
        const double factor =
            edgesView.surfacePrimary
                ? surfaceFactor(params.walkSurfaceFactor,
                                edgesView.surfacePrimary[edgeIdx])
                : 1.0;
        const double edgeTimeSec =
            (len / params.walkSpeedMps) * factor;  // seconds
        relaxEdge(u, layer, v, edgeTimeSec, MODE_FOOT);
      }
      // Mode switch: Walk -> Ride
      if (params.walkToRidePenaltyS >= 0.0)
      {
        relaxSwitch(u, Layer::Walk, Layer::Ride, params.walkToRidePenaltyS);
      }
    }
  }

  AStarResult result;
  if (goalState == UINT32_MAX)
  {
    result.success = false;
    return result;
  }

  // Build the state chain from start -> goal as (node, layer)
  std::vector<std::pair<uint32_t, Layer>> chain;
  chain.reserve(64);
  {
    std::vector<std::pair<uint32_t, Layer>> rev;
    for (uint32_t cur = goalState; cur != UINT32_MAX;)
    {
      rev.emplace_back(cur / 2u, static_cast<Layer>(cur % 2u));
      uint32_t p = parent[cur];
      if (p == UINT32_MAX) break;
      cur = p;
    }
    chain.assign(rev.rbegin(), rev.rend());
  }

  // Initialize outputs
  result.pathNodes.clear();
  result.pathModes.clear();
  result.pathNodes.reserve(chain.size());           // upper bound
  result.pathNodes.push_back(chain.front().first);  // starting node

  double totalMeters = 0.0;
  double totalSeconds = 0.0;

  auto addMove = [&](uint32_t u, uint32_t v, Layer layerU) {
    // Find directed edge u->v and add its cost/length
    for (uint32_t edgeIdx = edgesView.offsets[u];
         edgeIdx < edgesView.offsets[u + 1]; ++edgeIdx)
    {
      if (edgesView.neighbors[edgeIdx] != v) continue;

      if (layerU == Layer::Ride)
      {
        if ((edgesView.modeMask[edgeIdx] & MODE_BIKE) == 0) continue;
        if (edgesView.surfaceFlags &&
            (params.bikeSurfaceMask & edgesView.surfaceFlags[edgeIdx]) == 0)
          continue;
        const double len =
            static_cast<double>(edgesView.lengthsMeters[edgeIdx]);
        const double factor =
            edgesView.surfacePrimary
                ? surfaceFactor(params.bikeSurfaceFactor,
                                edgesView.surfacePrimary[edgeIdx])
                : 1.0;
        totalMeters += len;
        result.distanceBike += len;
        totalSeconds += (len / params.bikeSpeedMps) * factor;
        result.pathNodes.push_back(v);
        result.pathModes.push_back(MODE_BIKE);
        return true;
      }
      else
      {
        if ((edgesView.modeMask[edgeIdx] & MODE_FOOT) == 0) continue;
        if (edgesView.surfaceFlags && edgesView.surfaceFlags[edgeIdx] == 0)
          continue;
        const double len =
            static_cast<double>(edgesView.lengthsMeters[edgeIdx]);
        const double factor =
            edgesView.surfacePrimary
                ? surfaceFactor(params.walkSurfaceFactor,
                                edgesView.surfacePrimary[edgeIdx])
                : 1.0;
        totalMeters += len;
        result.distanceWalk += len;
        totalSeconds += (len / params.walkSpeedMps) * factor;
        result.pathNodes.push_back(v);
        result.pathModes.push_back(MODE_FOOT);
        return true;
      }
    }
    return false;  // shouldn't happen
  };

  for (size_t i{1}; i < chain.size(); ++i)
  {
    const auto [u, layerU] = chain[i - 1];
    const auto [v, layerV] = chain[i];

    if (u == v)
    {
      // Mode switch at the same node
      if (layerU != layerV)
      {
        if (layerU == Layer::Ride && layerV == Layer::Walk)
        {
          totalSeconds += params.ride_to_walk_penalty_s;
        }
        else if (layerU == Layer::Walk && layerV == Layer::Ride)
        {
          totalSeconds += params.walkToRidePenaltyS;
        }
      }
      continue;
    }
    // Movement u -> v in layerU
    (void)addMove(u, v, layerU);
  }

  result.distanceM = totalMeters;
  result.durationS = totalSeconds;
  result.success = true;
  // debug
  std::cout << "distanceBike in A*: " << result.distanceBike
            << std::endl;
  std::cout << "distanceWalk in A*: " << result.distanceWalk << std::endl;
  return result;
}

// ---------------- Global mapped graph ----------------
static NodesView glNodes;
static EdgesView glEdges;

// ---------------- N-API glue ----------------

static AStarParams parseParams(Napi::Env env, const Napi::Object& obj)
{
  AStarParams params;

  auto getNum = [&](const char* k, std::optional<double> def =
                                       std::nullopt) -> std::optional<double> {
    if (!obj.Has(k)) return def;
    Napi::Value v = obj.Get(k);
    if (!v.IsNumber()) return def;
    return v.As<Napi::Number>().DoubleValue();
  };

  auto getU32 = [&](const char* k,
                    std::optional<uint32_t> def =
                        std::nullopt) -> std::optional<uint32_t> {
    if (!obj.Has(k)) return def;
    Napi::Value v = obj.Get(k);
    if (!v.IsNumber()) return def;
    return v.As<Napi::Number>().Uint32Value();
  };

  // Masks (uint16)
  if (auto m = getU32("bikeSurfaceMask"))
    params.bikeSurfaceMask = static_cast<uint16_t>(*m);
  // if (auto m = getU32("walkSurfaceMask"))
  //   params.walkSurfaceMask = static_cast<uint16_t>(*m);

  // Speeds
  if (auto s = getNum("bikeSpeedMps")) params.bikeSpeedMps = *s;
  if (auto s = getNum("walkSpeedMps")) params.walkSpeedMps = *s;

  // Penalties
  if (auto s = getNum("rideToWalkPenaltyS")) params.ride_to_walk_penalty_s = *s;
  if (auto s = getNum("walkToRidePenaltyS")) params.walkToRidePenaltyS = *s;

  // Factors: arrays of numbers (index by surfacePrimary)
  auto loadFactors = [&](const char* k, std::vector<double>& out) {
    if (!obj.Has(k)) return;
    Napi::Value v = obj.Get(k);
    if (!v.IsArray()) return;
    Napi::Array arr = v.As<Napi::Array>();
    out.clear();
    out.resize(arr.Length(), 1.0);
    for (uint32_t i = 0; i < arr.Length(); ++i)
    {
      Napi::Value e = arr.Get(i);
      if (e.IsNumber())
        out[i] = e.As<Napi::Number>().DoubleValue();
      else
        out[i] = 1.0;
    }
  };
  loadFactors("bikeSurfaceFactor", params.bikeSurfaceFactor);
  loadFactors("walkSurfaceFactor", params.walkSurfaceFactor);

  // Basic sanity
  if (params.bikeSpeedMps <= 0.01 || params.walkSpeedMps <= 0.01)
    throw std::runtime_error("speeds must be positive");

  return params;
}

class FindPathWorker : public Napi::AsyncWorker
{
 public:
  FindPathWorker(const Napi::Function& cb, uint32_t sourceIdxIn,
                 uint32_t targetIdxIn, AStarParams params)
      : Napi::AsyncWorker(cb),
        sourceIdx(sourceIdxIn),
        targetIdx(targetIdxIn),
        params(std::move(params))
  {}

  void Execute() override
  {
    try
    {
      res = aStarTwoLayer(glEdges, glNodes, sourceIdx, targetIdx, params);
      if (!res.success) err = "no route";
    } catch (const std::exception& e)
    {
      err = e.what();
    }
  }

  void OnOK() override
  {
    Napi::Env env = Env();
    if (!err.empty())
    {
      Callback().Call({Napi::String::New(env, err), env.Null()});
      return;
    }
    Napi::Object out = Napi::Object::New(env);
    Napi::Array path = Napi::Array::New(env, res.pathNodes.size());
    for (uint32_t i{0}; i < res.pathNodes.size(); ++i)
    {
      path.Set(i, Napi::Number::New(env, res.pathNodes[i]));
    }
    out.Set("path", path);

    Napi::Array modes = Napi::Array::New(env, res.pathModes.size());
    for (uint32_t i{0}; i < res.pathModes.size(); ++i)
    {
      // 1=BIKE, 2=FOOT
      modes.Set(i, Napi::Number::New(env, res.pathModes[i]));
    }
    out.Set("modes", modes);

    out.Set("distanceM", Napi::Number::New(env, res.distanceM));
    out.Set("durationS", Napi::Number::New(env, res.durationS));

    // newStuff
    out.Set("distanceBike", Napi::Number::New(env, res.distanceBike));
    out.Set("distanceWalk", Napi::Number::New(env, res.distanceWalk));

    Callback().Call({env.Null(), out});
  }

 private:
  uint32_t sourceIdx;
  uint32_t targetIdx;
  AStarParams params;
  AStarResult res;
  std::string err;
};

// JS: findPath(options, callback)
// options = {
//   sourceIdx: <u32>, targetIdx: <u32>,
//   bikeSurfaceMask?: u16,
//   bikeSpeedMps?: number, walkSpeedMps?: number,
//   rideToWalkPenaltyS?: number, walkToRidePenaltyS?: number,
//   bikeSurfaceFactor?: number[], walkSurfaceFactor?: number[]
// }
Napi::Value FindPath(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();
  if (info.Length() < 2 || !info[0].IsObject() || !info[1].IsFunction())
  {
    Napi::TypeError::New(env, "usage: findPath(options, callback)")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Object opt = info[0].As<Napi::Object>();
  if (!opt.Has("sourceIdx") || !opt.Has("targetIdx") ||
      !opt.Get("sourceIdx").IsNumber() || !opt.Get("targetIdx").IsNumber())
  {
    Napi::TypeError::New(env,
                         "options must include numeric sourceIdx and targetIdx")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  uint32_t sourceIdx = opt.Get("sourceIdx").As<Napi::Number>().Uint32Value();
  uint32_t targetIdx = opt.Get("targetIdx").As<Napi::Number>().Uint32Value();

  AStarParams params;
  try
  {
    params = parseParams(env, opt);
  } catch (const std::exception& e)
  {
    Napi::TypeError::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }
  // rename
  auto cb = info[1].As<Napi::Function>();
  auto* worker =
      new FindPathWorker(cb, sourceIdx, targetIdx, std::move(params));
  worker->Queue();
  return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  try
  {
    glNodes = loadNodes("../data/graph_nodes.bin");
    glEdges = loadEdges("../data/graph_edges.bin");
    std::cerr << "[route] loaded numNodes =" << glNodes.numNodes
              << " numEdges =" << glEdges.numEdges << std::endl;

    // mmap tuning hints (optional)
    // ::madvise(const_cast<uint32_t*>(glEdges.offsets),
    //           sizeof(uint32_t) * (glEdges.N + 1), MADV_RANDOM);
    // ::madvise(const_cast<uint32_t*>(glEdges.neighbors),
    //           sizeof(uint32_t) * glEdges.E, MADV_RANDOM);
    // ::madvise(const_cast<float*>(glEdges.lengthsMeters), sizeof(float) *
    // glEdges.E,
    //           MADV_RANDOM);
    if (glEdges.surfaceFlags)
      ::madvise(const_cast<uint16_t*>(glEdges.surfaceFlags),
                sizeof(uint16_t) * glEdges.numEdges, MADV_RANDOM);
    if (glEdges.surfacePrimary)
      ::madvise(const_cast<uint8_t*>(glEdges.surfacePrimary),
                sizeof(uint8_t) * glEdges.numEdges, MADV_RANDOM);
    if (glEdges.modeMask)
      ::madvise(const_cast<uint8_t*>(glEdges.modeMask),
                sizeof(uint8_t) * glEdges.numEdges, MADV_RANDOM);

  } catch (const std::exception& e)
  {
    Napi::Error::New(env, std::string("[route] load failed: ") + e.what())
        .ThrowAsJavaScriptException();
  }
  exports.Set("findPath", Napi::Function::New(env, FindPath));
  return exports;
}

NODE_API_MODULE(route, Init)
