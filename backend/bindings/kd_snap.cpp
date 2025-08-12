// kd_snap.cpp — loads kd_nodes.bin (preferred) or graph_nodes.bin (fallback),
// builds a Boost.Geometry R-tree for nearest-node snapping.
//
// Exports:
//   findNearest(lat, lon) -> idx
//   getNode(idx) -> { idx, lat, lon }
//   filterKD([idx...]) -> void    // optional / deprecated in new flow

#include <napi.h>

#include <boost/geometry.hpp>
#include <boost/geometry/index/rtree.hpp>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <unordered_set>
#include <vector>
#include <cstring>

namespace bg  = boost::geometry;
namespace bgi = boost::geometry::index;

// ---------------- Binary headers (match your writer) ----------------
namespace nodes_blob {
struct NodesHeader {
  char     magic[8];        // "MMAPNODE"
  uint32_t version;         // = 1
  uint32_t num_nodes;       // N
  uint8_t  coord_type;      // 0=float32 degrees, 1=int32 microdegrees
  uint8_t  reserved[3];     // zero
};
static_assert(sizeof(NodesHeader) == 20, "NodesHeader must be 20 bytes");

enum CoordType : uint8_t { DegreesF32 = 0, MicrodegI32 = 1 };
} // namespace nodes_blob

// ---------------- Types ----------------
// Point in geographic degrees (lat,lon)
using Point = bg::model::point<double, 2, bg::cs::geographic<bg::degree>>;
// (point, node index)
using Value = std::pair<Point, uint32_t>;

// In-memory storage
static bgi::rtree<Value, bgi::quadratic<16>> g_tree;
static std::vector<float> g_lat, g_lon;    // fast access by idx
static std::vector<Value> g_allData;       // full dataset for optional filtering

// ---------------- Loaders ----------------

// Preferred: kd_nodes.bin
// Format: [uint32 numNodes] then N * (float32 lat, float32 lon, uint32 idx)
static bool LoadFromKdBin(const std::string& path) {
  std::ifstream in(path, std::ios::binary);
  if (!in) return false;

  uint32_t numNodes = 0;
  in.read(reinterpret_cast<char*>(&numNodes), sizeof(numNodes));
  if (!in) throw std::runtime_error("kd_nodes.bin: failed to read node count");

  std::vector<float> lat(numNodes), lon(numNodes);
  std::vector<Value> data; data.reserve(numNodes);

  for (uint32_t i = 0; i < numNodes; ++i) {
    float la, lo; uint32_t idx;
    in.read(reinterpret_cast<char*>(&la),  sizeof(la));
    in.read(reinterpret_cast<char*>(&lo),  sizeof(lo));
    in.read(reinterpret_cast<char*>(&idx), sizeof(idx));
    if (!in) throw std::runtime_error("kd_nodes.bin: truncated at record " + std::to_string(i));
    lat[i] = la; lon[i] = lo;
    data.emplace_back(Point{static_cast<double>(la), static_cast<double>(lo)}, idx);
  }

  g_lat.swap(lat);
  g_lon.swap(lon);
  g_allData.swap(data);
  g_tree = bgi::rtree<Value, bgi::quadratic<16>>(g_allData.begin(), g_allData.end());
  return true;
}

// Fallback: graph_nodes.bin (MMAPNODE v1)
// Layout:
//   NodesHeader
//   uint64 ids[N]
//   if coord_type==0: float lat[N], float lon[N]
//   if coord_type==1: int32 lat_u[N], int32 lon_u[N] (microdegrees)
static bool LoadFromGraphNodes(const std::string& path) {
  std::ifstream in(path, std::ios::binary);
  if (!in) return false;

  nodes_blob::NodesHeader hdr{};
  in.read(reinterpret_cast<char*>(&hdr), sizeof(hdr));
  if (!in) throw std::runtime_error("graph_nodes.bin: failed to read header");

  if (std::memcmp(hdr.magic, "MMAPNODE", 8) != 0 || hdr.version != 1) {
    throw std::runtime_error("graph_nodes.bin: bad magic or unsupported version");
  }

  const uint32_t N = hdr.num_nodes;

  // Skip ids
  in.seekg(static_cast<std::streamoff>(sizeof(uint64_t)) * N, std::ios::cur);
  if (!in) throw std::runtime_error("graph_nodes.bin: truncated ids");

  std::vector<float> lat(N), lon(N);
  std::vector<Value> data; data.reserve(N);

  if (hdr.coord_type == nodes_blob::DegreesF32) {
    // float32 degrees
    in.read(reinterpret_cast<char*>(lat.data()), sizeof(float) * N);
    if (!in) throw std::runtime_error("graph_nodes.bin: truncated lat[]");
    in.read(reinterpret_cast<char*>(lon.data()), sizeof(float) * N);
    if (!in) throw std::runtime_error("graph_nodes.bin: truncated lon[]");

    for (uint32_t i = 0; i < N; ++i) {
      data.emplace_back(Point{static_cast<double>(lat[i]), static_cast<double>(lon[i])}, i);
    }
  } else if (hdr.coord_type == nodes_blob::MicrodegI32) {
    // int32 microdegrees -> convert to float degrees
    std::vector<int32_t> lat_u(N), lon_u(N);
    in.read(reinterpret_cast<char*>(lat_u.data()), sizeof(int32_t) * N);
    if (!in) throw std::runtime_error("graph_nodes.bin: truncated lat_microdeg[]");
    in.read(reinterpret_cast<char*>(lon_u.data()), sizeof(int32_t) * N);
    if (!in) throw std::runtime_error("graph_nodes.bin: truncated lon_microdeg[]");

    constexpr double kScale = 1.0 / 1'000'000.0;
    for (uint32_t i = 0; i < N; ++i) {
      const float la = static_cast<float>(static_cast<double>(lat_u[i]) * kScale);
      const float lo = static_cast<float>(static_cast<double>(lon_u[i]) * kScale);
      lat[i] = la; lon[i] = lo;
      data.emplace_back(Point{static_cast<double>(la), static_cast<double>(lo)}, i);
    }
  } else {
    throw std::runtime_error("graph_nodes.bin: unknown coord_type");
  }

  g_lat.swap(lat);
  g_lon.swap(lon);
  g_allData.swap(data);
  g_tree = bgi::rtree<Value, bgi::quadratic<16>>(g_allData.begin(), g_allData.end());
  return true;
}

// Optional: rebuild the R-tree based on a filtered whitelist of node indices
static void RebuildKDFromFilter(const std::vector<uint32_t>& allowedIndices) {
  if (g_allData.empty())
    throw std::runtime_error("KD dataset not loaded");

  std::unordered_set<uint32_t> allowed(allowedIndices.begin(), allowedIndices.end());
  std::vector<Value> filtered; filtered.reserve(allowed.size());

  for (const auto& v : g_allData) {
    if (allowed.count(v.second)) filtered.push_back(v);
  }
  g_tree = bgi::rtree<Value, bgi::quadratic<16>>(filtered.begin(), filtered.end());
}

// ---------------- N-API bindings ----------------

Napi::Value FindNearest(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "Expected (lat:number, lon:number)").ThrowAsJavaScriptException();
    return env.Null();
  }

  const double lat = info[0].As<Napi::Number>().DoubleValue();
  const double lon = info[1].As<Napi::Number>().DoubleValue();

  if (g_allData.empty()) {
    Napi::Error::New(env, "KD dataset not loaded").ThrowAsJavaScriptException();
    return env.Null();
  }

  Point q(lat, lon);
  std::vector<Value> result;
  g_tree.query(bgi::nearest(q, 1), std::back_inserter(result));
  if (result.empty()) {
    Napi::Error::New(env, "R-tree is empty or no points match filter").ThrowAsJavaScriptException();
    return env.Null();
  }
  const uint32_t idx = result.front().second;
  return Napi::Number::New(env, idx);
}

Napi::Value GetNode(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1 || !info[0].IsNumber()) {
    Napi::TypeError::New(env, "Expected (idx:number)").ThrowAsJavaScriptException();
    return env.Null();
  }
  const uint32_t idx = info[0].As<Napi::Number>().Uint32Value();
  if (idx >= g_lat.size()) {
    Napi::RangeError::New(env, "Index out of range").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object obj = Napi::Object::New(env);
  obj.Set("idx", Napi::Number::New(env, idx));
  obj.Set("lat", Napi::Number::New(env, g_lat[idx]));
  obj.Set("lon", Napi::Number::New(env, g_lon[idx]));
  return obj;
}

Napi::Value FilterKD(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() != 1 || !info[0].IsArray()) {
    Napi::TypeError::New(env, "Expected (array of node indices)").ThrowAsJavaScriptException();
    return env.Null();
  }
  Napi::Array arr = info[0].As<Napi::Array>();
  std::vector<uint32_t> allowed; allowed.reserve(arr.Length());
  for (uint32_t i = 0; i < arr.Length(); ++i) {
    Napi::Value v = arr.Get(i);
    if (!v.IsNumber()) {
      Napi::TypeError::New(env, "Array must contain numbers").ThrowAsJavaScriptException();
      return env.Null();
    }
    allowed.push_back(v.As<Napi::Number>().Uint32Value());
  }
  try {
    RebuildKDFromFilter(allowed);
  } catch (const std::exception& e) {
    Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
  }
  return env.Null();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  try {
    // Prefer the compact KD blob; if missing, fall back to graph_nodes.bin
    if (!LoadFromKdBin("../data/kd_nodes.bin")) {
      std::cerr << "[kd_snap] kd_nodes.bin missing; trying graph_nodes.bin\n";
      if (!LoadFromGraphNodes("../data/graph_nodes.bin")) {
        throw std::runtime_error("Could not load kd_nodes.bin or graph_nodes.bin");
      }
    }
  } catch (const std::exception& e) {
    Napi::Error::New(env, std::string("[kd_snap] load failed: ") + e.what()).ThrowAsJavaScriptException();
    return exports;
  }

  exports.Set("findNearest", Napi::Function::New(env, FindNearest));
  exports.Set("getNode",      Napi::Function::New(env, GetNode));
  exports.Set("filterKD",     Napi::Function::New(env, FilterKD)); // optional/deprecated
  return exports;
}

NODE_API_MODULE(kd_snap, Init)
