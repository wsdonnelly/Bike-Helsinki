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
#include <utility>
#include <vector>

// ---------------- Blob headers (match your ingest/writer) ----------------
namespace blob
{

struct NodesHeader
{
  char magic[8];        // "MMAPNODE"
  uint32_t version;     // = 1
  uint32_t num_nodes;   // N
  uint8_t coord_type;   // 0=float32 degrees, 1=int32 microdegrees
  uint8_t reserved[3];  // zero
};
static_assert(sizeof(NodesHeader) == 20, "NodesHeader must be 20 bytes");

struct EdgesHeader
{
  char magic[8];                // "MMAPGRPH"
  uint32_t version;             // = 1
  uint32_t num_nodes;           // N
  uint32_t num_edges;           // E (directed)
  uint8_t has_surface_primary;  // =1
  uint8_t has_surface_flags;    // =1
  uint8_t has_mode_mask;        // =1
  uint8_t length_type;          // 0=float32 meters
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
  int fd = -1;

  MappedFile() = default;
  MappedFile(const MappedFile&) = delete;
  MappedFile& operator=(const MappedFile&) = delete;

  MappedFile(MappedFile&& o) noexcept { *this = std::move(o); }
  MappedFile& operator=(MappedFile&& o) noexcept
  {
    if (this != &o)
    {
      if (base) ::munmap(base, size);
      if (fd >= 0) ::close(fd);
      base = o.base;
      size = o.size;
      fd = o.fd;
      o.base = nullptr;
      o.size = 0;
      o.fd = -1;
    }
    return *this;
  }

  ~MappedFile()
  {
    if (base) ::munmap(base, size);
    if (fd >= 0) ::close(fd);
  }
};

// 2) Return a shared_ptr directly (no by-value temporary)
static std::shared_ptr<MappedFile> map_readonly_sp(const std::string& path)
{
  auto m = std::make_shared<MappedFile>();
  m->fd = ::open(path.c_str(), O_RDONLY);
  if (m->fd < 0) throw std::runtime_error("open failed: " + path);
  struct stat st{};
  if (::fstat(m->fd, &st) != 0)
    throw std::runtime_error("fstat failed: " + path);
  m->size = static_cast<size_t>(st.st_size);
  m->base = ::mmap(nullptr, m->size, PROT_READ, MAP_PRIVATE, m->fd, 0);
  if (m->base == MAP_FAILED)
  {
    ::close(m->fd);
    m->fd = -1;
    throw std::runtime_error("mmap failed: " + path);
  }
  return m;
}

// ---------------- Typed views over the blobs ----------------
struct NodesView
{
  std::shared_ptr<MappedFile> hold;  // keep mapping alive
  uint32_t N = 0;
  const uint64_t* ids = nullptr;
  const float* lat_f32 = nullptr;  // if coord_type==0
  const float* lon_f32 = nullptr;
  const int32_t* lat_i32 = nullptr;  // if coord_type==1 (microdegrees)
  const int32_t* lon_i32 = nullptr;
  blob::CoordType coord = blob::DegreesF32;
};

struct EdgesView
{
  std::shared_ptr<MappedFile> hold;  // keep mapping alive
  uint32_t N = 0, E = 0;
  const uint32_t* offsets = nullptr;         // N+1
  const uint32_t* neighbors = nullptr;       // E
  const float* length_m = nullptr;           // E
  const uint16_t* surface_flags = nullptr;   // E
  const uint8_t* surface_primary = nullptr;  // E
  const uint8_t* mode_mask = nullptr;        // E (bit0=BIKE, bit1=FOOT)
};

static NodesView load_nodes(const std::string& path)
{
  auto hold = map_readonly_sp(path);
  const char* p = static_cast<const char*>(hold->base);
  const char* end = p + hold->size;

  auto need = [&](size_t n) {
    if (p + n > end) throw std::runtime_error("nodes blob truncated");
  };

  need(sizeof(blob::NodesHeader));
  const auto* hdr = reinterpret_cast<const blob::NodesHeader*>(p);
  if (std::memcmp(hdr->magic, "MMAPNODE", 8) != 0 || hdr->version != 1)
    throw std::runtime_error("bad nodes header");
  p += sizeof(*hdr);

  NodesView v;
  v.hold = hold;
  v.N = hdr->num_nodes;
  v.coord = static_cast<blob::CoordType>(hdr->coord_type);

  need(sizeof(uint64_t) * v.N);
  v.ids = reinterpret_cast<const uint64_t*>(p);
  p += sizeof(uint64_t) * v.N;

  if (v.coord == blob::DegreesF32)
  {
    need(sizeof(float) * v.N * 2);
    v.lat_f32 = reinterpret_cast<const float*>(p);
    p += sizeof(float) * v.N;
    v.lon_f32 = reinterpret_cast<const float*>(p);
    p += sizeof(float) * v.N;
  } else
  {
    need(sizeof(int32_t) * v.N * 2);
    v.lat_i32 = reinterpret_cast<const int32_t*>(p);
    p += sizeof(int32_t) * v.N;
    v.lon_i32 = reinterpret_cast<const int32_t*>(p);
    p += sizeof(int32_t) * v.N;
  }
  return v;
}

static EdgesView load_edges(const std::string& path)
{
  auto hold = map_readonly_sp(path);
  const char* p = static_cast<const char*>(hold->base);
  const char* end = p + hold->size;

  auto need = [&](size_t n) {
    if (p + n > end) throw std::runtime_error("edges blob truncated");
  };

  const auto* hdr = reinterpret_cast<const blob::EdgesHeader*>(p);
  bool okMagic = (std::memcmp(hdr->magic, "MMAPGRPH", 8) == 0) ||
                 (std::memcmp(hdr->magic, "MMAPEDGE", 8) ==
                  0);  // accept your current magic
  if (!okMagic || hdr->version != 1)
    throw std::runtime_error("bad edges header");
  p += sizeof(*hdr);

  uint32_t off_len, nei_len, len_len, flg_len, prim_len, mode_len;
  need(6 * sizeof(uint32_t));
  std::memcpy(&off_len, p, 4);
  p += 4;
  std::memcpy(&nei_len, p, 4);
  p += 4;
  std::memcpy(&len_len, p, 4);
  p += 4;
  std::memcpy(&flg_len, p, 4);
  p += 4;
  std::memcpy(&prim_len, p, 4);
  p += 4;
  std::memcpy(&mode_len, p, 4);
  p += 4;

  if (off_len != hdr->num_nodes + 1 || nei_len != hdr->num_edges ||
      len_len != hdr->num_edges)
    throw std::runtime_error("lengths block mismatch");

  EdgesView v;
  v.hold = hold;
  v.N = hdr->num_nodes;
  v.E = hdr->num_edges;

  need(sizeof(uint32_t) * off_len);
  v.offsets = reinterpret_cast<const uint32_t*>(p);
  p += sizeof(uint32_t) * off_len;

  need(sizeof(uint32_t) * nei_len);
  v.neighbors = reinterpret_cast<const uint32_t*>(p);
  p += sizeof(uint32_t) * nei_len;

  need(sizeof(float) * len_len);
  v.length_m = reinterpret_cast<const float*>(p);
  p += sizeof(float) * len_len;

  if (hdr->has_surface_flags)
  {
    need(sizeof(uint16_t) * flg_len);
    v.surface_flags = reinterpret_cast<const uint16_t*>(p);
    p += sizeof(uint16_t) * flg_len;
  }
  if (hdr->has_surface_primary)
  {
    need(sizeof(uint8_t) * prim_len);
    v.surface_primary = reinterpret_cast<const uint8_t*>(p);
    p += sizeof(uint8_t) * prim_len;
  }
  if (hdr->has_mode_mask)
  {
    need(sizeof(uint8_t) * mode_len);
    v.mode_mask = reinterpret_cast<const uint8_t*>(p);
    p += sizeof(uint8_t) * mode_len;
  }
  if (!v.mode_mask) throw std::runtime_error("edges blob missing mode_mask");
  if (v.offsets[0] != 0 || v.offsets[v.N] != v.E)
    throw std::runtime_error("bad CSR offsets");

  return v;
}

// ---------------- Utilities ----------------
static inline void node_deg(const NodesView& nv, uint32_t idx, double& lat_deg,
                            double& lon_deg)
{
  if (nv.coord == blob::DegreesF32)
  {
    lat_deg = static_cast<double>(nv.lat_f32[idx]);
    lon_deg = static_cast<double>(nv.lon_f32[idx]);
  } else
  {
    lat_deg = static_cast<double>(nv.lat_i32[idx]) * 1e-6;
    lon_deg = static_cast<double>(nv.lon_i32[idx]) * 1e-6;
  }
}

static inline double haversine_m(double lat1_deg, double lon1_deg,
                                 double lat2_deg, double lon2_deg)
{
  constexpr double kPi = 3.14159265358979323846;
  constexpr double kEarthRadiusMeters = 6371000.0;
  auto toRad = [&](double degrees) { return degrees * kPi / 180.0; };

  const double deltaLatRad = toRad(lat2_deg - lat1_deg);
  const double deltaLonRad = toRad(lon2_deg - lon1_deg);
  const double lat1Rad = toRad(lat1_deg);
  const double lat2Rad = toRad(lat2_deg);

  const double sinHalfDeltaLat = std::sin(deltaLatRad / 2.0);
  const double sinHalfDeltaLon = std::sin(deltaLonRad / 2.0);

  const double haversineTerm =
      sinHalfDeltaLat * sinHalfDeltaLat +
      std::cos(lat1Rad) * std::cos(lat2Rad) * sinHalfDeltaLon * sinHalfDeltaLon;

  const double centralAngleRad =
      2.0 *
      std::atan2(std::sqrt(haversineTerm), std::sqrt(1.0 - haversineTerm));

  return kEarthRadiusMeters * centralAngleRad;
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
  uint16_t bike_surface_mask = 0xFFFF;
  uint16_t walk_surface_mask = 0xFFFF;

  // Speeds (m/s)
  double bike_speed_mps = 6.0;  // ~21.6 km/h
  double walk_speed_mps = 1.5;  // ~5.4 km/h

  // Penalties (seconds) to switch modes at a node
  double ride_to_walk_penalty_s = 5.0;  // dismount
  double walk_to_ride_penalty_s = 3.0;  // remount

  // Per-surface primary multipliers (index by uint8 surface_primary)
  // If empty, all factors default to 1.0
  std::vector<double> bike_surface_factor;
  std::vector<double> walk_surface_factor;
};

struct AStarResult
{
  bool success = false;
  std::vector<uint32_t> path_nodes;  // node indices s..t
  std::vector<uint8_t> path_modes;   // MODE_* for each step between nodes;
                                     // length = path_nodes.size()-1
  double distance_m = 0.0;
  double duration_s = 0.0;
};

// Get factor by primary index; default 1.0 if out-of-range or table missing
static inline double surface_factor(const std::vector<double>& tbl,
                                    uint8_t primary)
{
  if (tbl.empty()) return 1.0;
  if (primary < tbl.size()) return tbl[primary];
  return 1.0;
}

struct PQItem
{
  double f;                                                  // f = g + h
  uint32_t node;                                             // graph node
  Layer layer;                                               // Ride/Walk
  bool operator<(const PQItem& o) const { return f > o.f; }  // min-heap
};

struct StateKey
{  // encode (node, layer) to index [0..2N)
  static inline uint32_t idx(uint32_t node, Layer layer, uint32_t N)
  {
    return node * 2u + static_cast<uint32_t>(layer);
  }
};

// Core A* (goal: reach node t in either layer with min time)
static AStarResult astar_two_layer(const EdgesView& g, const NodesView& nv,
                                   uint32_t s, uint32_t t, const AStarParams& P)
{
  const uint32_t N = g.N;
  if (s >= N || t >= N) throw std::runtime_error("source/target out of range");

  // Heuristic uses the *fastest* mode speed to remain admissible across layers.
  double latT, lonT;
  node_deg(nv, t, latT, lonT);
  const double vmax = std::max(P.bike_speed_mps, P.walk_speed_mps);
  auto h = [&](uint32_t u) -> double {
    double latU, lonU;
    node_deg(nv, u, latU, lonU);
    return haversine_m(latU, lonU, latT, lonT) / vmax;  // optimistic
  };

  const double INF = std::numeric_limits<double>::infinity();
  const uint32_t S_ride = StateKey::idx(s, Layer::Ride, N);
  const uint32_t S_walk = StateKey::idx(s, Layer::Walk, N);

  // We allow starting in either layer with zero cost.
  std::vector<double> gscore(2 * N, INF);
  std::vector<uint32_t> parent(2 * N, UINT32_MAX);  // parent state index
  std::vector<uint8_t> parent_step_mode(
      2 * N, 0);  // MODE_* used to move from parent to this (0 if mode-switch
                  // at same node)

  gscore[S_ride] = 0.0;
  gscore[S_walk] = 0.0;

  std::priority_queue<PQItem> open;
  open.push(PQItem{gscore[S_ride] + h(s), s, Layer::Ride});
  open.push(PQItem{gscore[S_walk] + h(s), s, Layer::Walk});

  std::vector<char> closed(2 * N, 0);

  auto relax_edge = [&](uint32_t u, Layer layerU, uint32_t v, double edgeTime_s,
                        uint8_t edgeModeBit) {
    const uint32_t curIdx = StateKey::idx(u, layerU, N);
    const uint32_t nextIdx =
        StateKey::idx(v, layerU, N);  // same layer (movement)
    const double tentative = gscore[curIdx] + edgeTime_s;
    if (tentative < gscore[nextIdx])
    {
      gscore[nextIdx] = tentative;
      parent[nextIdx] = curIdx;
      parent_step_mode[nextIdx] = edgeModeBit;
      open.push(PQItem{tentative + h(v), v, layerU});
    }
  };

  auto relax_switch = [&](uint32_t u, Layer from, Layer to, double penalty_s) {
    const uint32_t fromIdx = StateKey::idx(u, from, N);
    const uint32_t toIdx = StateKey::idx(u, to, N);
    const double tentative = gscore[fromIdx] + penalty_s;
    if (tentative < gscore[toIdx])
    {
      gscore[toIdx] = tentative;
      parent[toIdx] = fromIdx;
      parent_step_mode[toIdx] = 0;  // mode switch at same node
      open.push(PQItem{tentative + h(u), u, to});
    }
  };

  uint32_t goal_state = UINT32_MAX;

  while (!open.empty())
  {
    PQItem it = open.top();
    open.pop();
    const uint32_t u = it.node;
    const Layer layer = it.layer;
    const uint32_t uIdx = StateKey::idx(u, layer, N);
    if (closed[uIdx]) continue;
    closed[uIdx] = 1;

    // Goal test: first time we pop t in any layer, we have the optimal arrival.
    if (u == t)
    {
      goal_state = uIdx;
      break;
    }

    const uint32_t begin = g.offsets[u];
    const uint32_t end = g.offsets[u + 1];

    if (layer == Layer::Ride)
    {
      // Movement on ride-allowed edges and allowed bike surfaces
      for (uint32_t ei = begin; ei < end; ++ei)
      {
        if ((g.mode_mask[ei] & MODE_BIKE) == 0) continue;
        if (g.surface_flags && (P.bike_surface_mask & g.surface_flags[ei]) == 0)
          continue;
        const uint32_t v = g.neighbors[ei];
        const double len = static_cast<double>(g.length_m[ei]);
        const double factor =
            g.surface_primary
                ? surface_factor(P.bike_surface_factor, g.surface_primary[ei])
                : 1.0;
        const double w = (len / P.bike_speed_mps) * factor;  // seconds
        relax_edge(u, layer, v, w, MODE_BIKE);
      }
      // Mode switch: Ride -> Walk
      if (P.ride_to_walk_penalty_s >= 0.0)
        relax_switch(u, Layer::Ride, Layer::Walk, P.ride_to_walk_penalty_s);
    } else
    {
      // Movement on foot-allowed edges and allowed walk surfaces
      for (uint32_t ei = begin; ei < end; ++ei)
      {
        if ((g.mode_mask[ei] & MODE_FOOT) == 0) continue;
        if (g.surface_flags && (P.walk_surface_mask & g.surface_flags[ei]) == 0)
          continue;
        const uint32_t v = g.neighbors[ei];
        const double len = static_cast<double>(g.length_m[ei]);
        const double factor =
            g.surface_primary
                ? surface_factor(P.walk_surface_factor, g.surface_primary[ei])
                : 1.0;
        const double w = (len / P.walk_speed_mps) * factor;  // seconds
        relax_edge(u, layer, v, w, MODE_FOOT);
      }
      // Mode switch: Walk -> Ride
      if (P.walk_to_ride_penalty_s >= 0.0)
        relax_switch(u, Layer::Walk, Layer::Ride, P.walk_to_ride_penalty_s);
    }
  }

  AStarResult R;
  if (goal_state == UINT32_MAX)
  {
    R.success = false;
    return R;
  }

  // Build the state chain from start -> goal as (node, layer)
  std::vector<std::pair<uint32_t, Layer>> chain;
  chain.reserve(64);
  {
    std::vector<std::pair<uint32_t, Layer>> rev;
    for (uint32_t cur = goal_state; cur != UINT32_MAX;)
    {
      rev.emplace_back(cur / 2u, static_cast<Layer>(cur % 2u));
      uint32_t p = parent[cur];
      if (p == UINT32_MAX) break;
      cur = p;
    }
    chain.assign(rev.rbegin(), rev.rend());
  }

  // Initialize outputs
  R.path_nodes.clear();
  R.path_modes.clear();
  R.path_nodes.reserve(chain.size());           // upper bound
  R.path_nodes.push_back(chain.front().first);  // starting node

  double total_m = 0.0;
  double total_s = 0.0;

  auto add_move = [&](uint32_t u, uint32_t v, Layer layerU) {
    // Find directed edge u->v and add its cost/length
    for (uint32_t ei = g.offsets[u]; ei < g.offsets[u + 1]; ++ei)
    {
      if (g.neighbors[ei] != v) continue;

      if (layerU == Layer::Ride)
      {
        if ((g.mode_mask[ei] & MODE_BIKE) == 0) continue;
        if (g.surface_flags && (P.bike_surface_mask & g.surface_flags[ei]) == 0)
          continue;
        const double len = static_cast<double>(g.length_m[ei]);
        const double factor =
            g.surface_primary
                ? surface_factor(P.bike_surface_factor, g.surface_primary[ei])
                : 1.0;
        total_m += len;
        total_s += (len / P.bike_speed_mps) * factor;
        R.path_nodes.push_back(v);
        R.path_modes.push_back(MODE_BIKE);
        return true;
      } else
      {
        if ((g.mode_mask[ei] & MODE_FOOT) == 0) continue;
        if (g.surface_flags && (P.walk_surface_mask & g.surface_flags[ei]) == 0)
          continue;
        const double len = static_cast<double>(g.length_m[ei]);
        const double factor =
            g.surface_primary
                ? surface_factor(P.walk_surface_factor, g.surface_primary[ei])
                : 1.0;
        total_m += len;
        total_s += (len / P.walk_speed_mps) * factor;
        R.path_nodes.push_back(v);
        R.path_modes.push_back(MODE_FOOT);
        return true;
      }
    }
    return false;  // shouldn't happen
  };

  for (size_t i = 1; i < chain.size(); ++i)
  {
    const auto [u, layerU] = chain[i - 1];
    const auto [v, layerV] = chain[i];

    if (u == v)
    {
      // Mode switch at the same node
      if (layerU != layerV)
      {
        if (layerU == Layer::Ride && layerV == Layer::Walk)
          total_s += P.ride_to_walk_penalty_s;
        else if (layerU == Layer::Walk && layerV == Layer::Ride)
          total_s += P.walk_to_ride_penalty_s;
      }
      continue;
    }
    // Movement u -> v in layerU
    (void)add_move(u, v, layerU);
  }

  R.distance_m = total_m;
  R.duration_s = total_s;
  R.success = true;
  return R;
}

// ---------------- Global mapped graph ----------------
static NodesView G_nodes;
static EdgesView G_edges;

// ---------------- N-API glue ----------------

static AStarParams parseParams(Napi::Env env, const Napi::Object& obj)
{
  AStarParams P;

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
    P.bike_surface_mask = static_cast<uint16_t>(*m);
  if (auto m = getU32("walkSurfaceMask"))
    P.walk_surface_mask = static_cast<uint16_t>(*m);

  // Speeds
  if (auto s = getNum("bikeSpeedMps")) P.bike_speed_mps = *s;
  if (auto s = getNum("walkSpeedMps")) P.walk_speed_mps = *s;

  // Penalties
  if (auto s = getNum("rideToWalkPenaltyS")) P.ride_to_walk_penalty_s = *s;
  if (auto s = getNum("walkToRidePenaltyS")) P.walk_to_ride_penalty_s = *s;

  // Factors: arrays of numbers (index by surface_primary)
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
  loadFactors("bikeSurfaceFactor", P.bike_surface_factor);
  loadFactors("walkSurfaceFactor", P.walk_surface_factor);

  // Basic sanity
  if (P.bike_speed_mps <= 0.01 || P.walk_speed_mps <= 0.01)
    throw std::runtime_error("speeds must be positive");

  return P;
}

class FindPathWorker : public Napi::AsyncWorker
{
 public:
  FindPathWorker(const Napi::Function& cb, uint32_t s, uint32_t t,
                 AStarParams P)
      : Napi::AsyncWorker(cb), s_(s), t_(t), P_(std::move(P))
  {}

  void Execute() override
  {
    try
    {
      res_ = astar_two_layer(G_edges, G_nodes, s_, t_, P_);
      if (!res_.success) err_ = "no route";
    } catch (const std::exception& e)
    {
      err_ = e.what();
    }
  }

  void OnOK() override
  {
    Napi::Env env = Env();
    if (!err_.empty())
    {
      Callback().Call({Napi::String::New(env, err_), env.Null()});
      return;
    }
    Napi::Object out = Napi::Object::New(env);
    Napi::Array path = Napi::Array::New(env, res_.path_nodes.size());
    for (uint32_t i = 0; i < res_.path_nodes.size(); ++i)
      path.Set(i, Napi::Number::New(env, res_.path_nodes[i]));
    out.Set("path", path);

    Napi::Array modes = Napi::Array::New(env, res_.path_modes.size());
    for (uint32_t i = 0; i < res_.path_modes.size(); ++i)
      modes.Set(i,
                Napi::Number::New(env, res_.path_modes[i]));  // 1=BIKE, 2=FOOT
    out.Set("modes", modes);

    out.Set("distance_m", Napi::Number::New(env, res_.distance_m));
    out.Set("duration_s", Napi::Number::New(env, res_.duration_s));
    Callback().Call({env.Null(), out});
  }

 private:
  uint32_t s_, t_;
  AStarParams P_;
  AStarResult res_;
  std::string err_;
};

// JS: findPath(options, callback)
// options = {
//   sourceIdx: <u32>, targetIdx: <u32>,
//   bikeSurfaceMask?: u16, walkSurfaceMask?: u16,
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

  uint32_t s = opt.Get("sourceIdx").As<Napi::Number>().Uint32Value();
  uint32_t t = opt.Get("targetIdx").As<Napi::Number>().Uint32Value();

  AStarParams P;
  try
  {
    P = parseParams(env, opt);
  } catch (const std::exception& e)
  {
    Napi::TypeError::New(env, e.what()).ThrowAsJavaScriptException();
    return env.Undefined();
  }

  auto cb = info[1].As<Napi::Function>();
  auto* worker = new FindPathWorker(cb, s, t, std::move(P));
  worker->Queue();
  return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  try
  {
    G_nodes = load_nodes("../data/graph_nodes.bin");
    G_edges = load_edges("../data/graph_edges.bin");
    std::cerr << "[route] loaded N=" << G_nodes.N << " E=" << G_edges.E
              << std::endl;

    // mmap tuning hints (optional)
    // ::madvise(const_cast<uint32_t*>(G_edges.offsets),
    //           sizeof(uint32_t) * (G_edges.N + 1), MADV_RANDOM);
    // ::madvise(const_cast<uint32_t*>(G_edges.neighbors),
    //           sizeof(uint32_t) * G_edges.E, MADV_RANDOM);
    // ::madvise(const_cast<float*>(G_edges.length_m), sizeof(float) *
    // G_edges.E,
    //           MADV_RANDOM);
    if (G_edges.surface_flags)
      ::madvise(const_cast<uint16_t*>(G_edges.surface_flags),
                sizeof(uint16_t) * G_edges.E, MADV_RANDOM);
    if (G_edges.surface_primary)
      ::madvise(const_cast<uint8_t*>(G_edges.surface_primary),
                sizeof(uint8_t) * G_edges.E, MADV_RANDOM);
    if (G_edges.mode_mask)
      ::madvise(const_cast<uint8_t*>(G_edges.mode_mask),
                sizeof(uint8_t) * G_edges.E, MADV_RANDOM);

  } catch (const std::exception& e)
  {
    Napi::Error::New(env, std::string("[route] load failed: ") + e.what())
        .ThrowAsJavaScriptException();
  }
  exports.Set("findPath", Napi::Function::New(env, FindPath));
  return exports;
}

NODE_API_MODULE(route, Init)
