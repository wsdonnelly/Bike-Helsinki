// kd_snap.cpp — loads graph_nodes.bin
// builds a Boost.Geometry R-tree for nearest-node snapping.
//
// Exports:
//   findNearest(lat, lon) -> idx
//   getNode(idx) -> { idx, lat, lon }

#include <napi.h>

#include <boost/geometry.hpp>
#include <boost/geometry/index/rtree.hpp>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <vector>

#include "blobHeaders.hpp"

namespace bg = boost::geometry;
namespace bgi = boost::geometry::index;

// ---------------- Binary headers (must match buildGraph.cpp) ----------------

namespace geo
{
// Geographic point dimensionality (lat, lon)
static constexpr std::size_t kLatLonDims{2};

// Max number of values per R-tree node (tune for perf/memory)
static constexpr std::size_t kRtreeMaxValuesPerNode{16};

using Point =
    bg::model::point<double, kLatLonDims, bg::cs::geographic<bg::degree>>;
using RTreeParams = bgi::quadratic<kRtreeMaxValuesPerNode>;
// If you prefer R*-tree: using RTreeParams =
// bgi::rstar<kRtreeMaxValuesPerNode>;
}  // namespace geo

using Value = std::pair<geo::Point, uint32_t>;

// ---------------- In-memory storage ----------------
static bgi::rtree<Value, geo::RTreeParams> gTree;
static std::vector<float> gLat;  // degrees
static std::vector<float> gLon;  // degrees

// ---------------- Load helpers ----------------

static void buildTreeFromLatLon()
{
  // Build a temporary packed set of Values, then construct the R-tree.
  std::vector<Value> values;
  values.reserve(gLat.size());
  for (uint32_t i{0}; i < gLat.size(); ++i)
  {
    values.emplace_back(
        geo::Point{static_cast<double>(gLat[i]), static_cast<double>(gLon[i])},
        i);
  }
  gTree = bgi::rtree<Value, bgi::quadratic<16>>(values.begin(), values.end());
  // 'values' goes out of scope; the rtree keeps its own storage.
}

// graph_nodes.bin (MMAPNODE v1)
// Layout:
//   NodesHeader
//   uint64 ids[N]        (we skip)
//   if coordType==0: float lat[N], float lon[N]
//   if coordType==1: int32 lat_u[N], int32 lon_u[N] (microdegrees)
static bool loadFromGraphNodes(const std::string& path)
{
  std::ifstream in(path, std::ios::binary);
  if (!in) return false;

  injest::NodesHeader hdr{};
  in.read(reinterpret_cast<char*>(&hdr), sizeof(hdr));
  if (!in) throw std::runtime_error("graph_nodes.bin: failed to read header");
  if (std::memcmp(hdr.magic, "MMAPNODE", 8) != 0)
    throw std::runtime_error(
        "graph_nodes.bin: bad magic or unsupported version");

  const uint32_t N = hdr.numNodes;

  // Skip ids[N]
  in.seekg(static_cast<std::streamoff>(sizeof(uint64_t)) * N, std::ios::cur);
  if (!in) throw std::runtime_error("graph_nodes.bin: truncated ids");

  gLat.resize(N);
  gLon.resize(N);

  // float32 degrees coords
  in.read(reinterpret_cast<char*>(gLat.data()), sizeof(float) * N);
  if (!in) throw std::runtime_error("graph_nodes.bin: truncated lat[]");
  in.read(reinterpret_cast<char*>(gLon.data()), sizeof(float) * N);
  if (!in) throw std::runtime_error("graph_nodes.bin: truncated lon[]");

  buildTreeFromLatLon();
  return true;
}

// ---------------- N-API bindings ----------------

Napi::Value findNearest(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();
  if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber())
  {
    Napi::TypeError::New(env, "Expected (lat:number, lon:number)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  const double lat = info[0].As<Napi::Number>().DoubleValue();
  const double lon = info[1].As<Napi::Number>().DoubleValue();

  if (gLat.empty())
  {
    Napi::Error::New(env, "R-tree not loaded").ThrowAsJavaScriptException();
    return env.Null();
  }

  geo::Point q(lat, lon);
  std::vector<Value> out;
  gTree.query(bgi::nearest(q, 1), std::back_inserter(out));
  if (out.empty())
  {
    Napi::Error::New(env, "R-tree is empty").ThrowAsJavaScriptException();
    return env.Null();
  }
  const uint32_t idx = out.front().second;
  return Napi::Number::New(env, idx);
}

Napi::Value getNode(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();
  if (info.Length() != 1 || !info[0].IsNumber())
  {
    Napi::TypeError::New(env, "Expected (idx:number)")
        .ThrowAsJavaScriptException();
    return env.Null();
  }
  const uint32_t idx = info[0].As<Napi::Number>().Uint32Value();
  if (idx >= gLat.size())
  {
    Napi::RangeError::New(env, "Index out of range")
        .ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object obj = Napi::Object::New(env);
  obj.Set("idx", Napi::Number::New(env, idx));
  obj.Set("lat", Napi::Number::New(env, gLat[idx]));
  obj.Set("lon", Napi::Number::New(env, gLon[idx]));
  return obj;
}

// kd_snap.cpp (add near your other exports)
Napi::Value GetLatArray(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();
  if (gLat.empty())
  {
    // Return an empty typed array rather than an ArrayBuffer to nullptr
    return Napi::Float32Array::New(env, 0);
  }

  // Create an external ArrayBuffer that wraps the vector's storage.
  // We pass a no-op finalizer so Node won't free memory we own.
  Napi::ArrayBuffer buf = Napi::ArrayBuffer::New(
      env, static_cast<void*>(gLat.data()), gLat.size() * sizeof(float),
      [](Napi::Env /*env*/, void* /*data*/) {});

  // Create the typed array view on that buffer (no copy)
  return Napi::Float32Array::New(env, gLat.size(), buf, /*byteOffset=*/0);
}

Napi::Value GetLonArray(const Napi::CallbackInfo& info)
{
  Napi::Env env = info.Env();
  if (gLon.empty())
  {
    return Napi::Float32Array::New(env, 0);
  }

  Napi::ArrayBuffer buf = Napi::ArrayBuffer::New(
      env, static_cast<void*>(gLon.data()), gLon.size() * sizeof(float),
      [](Napi::Env /*env*/, void* /*data*/) {});

  return Napi::Float32Array::New(env, gLon.size(), buf, 0);
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
  try
  {
    if (!loadFromGraphNodes("../data/graph_nodes.bin"))
    {
      std::cerr << "[kd_snap] graph_nodes.bin missing\n";
    }
  } catch (const std::exception& e)
  {
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
