// route.cpp — N-API addon: mmap + CSR A* with ride/walk layers & mode
// switching. Build with your binding.gyp using node-addon-api (C++17+).

#include "route.hpp"

#include <fcntl.h>
#include <napi.h>
#include <sys/stat.h>

#include <cstring>
#include <iostream>
#include <optional>
#include <string>
#include <system_error>
#include <utility>

#include "aStar.hpp"
#include "binHeaders.hpp"

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

static NodesView loadNodes(const std::string& filePath)
{
  auto mapping = mapReadonlySp(filePath);
  const char* cursor = static_cast<const char*>(mapping->base);
  const char* endPtr = cursor + mapping->size;

  auto requireBytes = [&](size_t bytes) {
    if (cursor + bytes > endPtr)
    {
      throw std::runtime_error("nodes bin truncated");
    }
  };

  // Header
  requireBytes(sizeof(injest::NodesHeader));
  const auto* header = reinterpret_cast<const injest::NodesHeader*>(cursor);
  if (std::memcmp(header->magic, "MMAPNODE", 8) != 0)
  {
    throw std::runtime_error("bad nodes header");
  }
  cursor += sizeof(*header);

  NodesView nodesView;
  nodesView.hold = mapping;
  nodesView.numNodes = header->numNodes;

  // IDs
  requireBytes(sizeof(uint64_t) * nodesView.numNodes);
  nodesView.ids = reinterpret_cast<const uint64_t*>(cursor);
  cursor += sizeof(uint64_t) * nodesView.numNodes;

  // Coordinates
  requireBytes(sizeof(float) * nodesView.numNodes * 2);
  nodesView.lat_f32 = reinterpret_cast<const float*>(cursor);
  cursor += sizeof(float) * nodesView.numNodes;
  nodesView.lon_f32 = reinterpret_cast<const float*>(cursor);
  cursor += sizeof(float) * nodesView.numNodes;

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
      throw std::runtime_error("edges bin truncated: " + filePath);
    }
  };

  // --- Header ---
  requireBytes(sizeof(injest::EdgesHeader));
  const auto* header = reinterpret_cast<const injest::EdgesHeader*>(cursor);

  // accept both
  const bool okMagic = (std::memcmp(header->magic, "MMAPGRPH", 8) == 0) ||
                       (std::memcmp(header->magic, "MMAPEDGE", 8) == 0);
  if (!okMagic)
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
  uint32_t offsetsSize, neighborsSize, lengthsSize, surfacePrimarySize,
      modeMasksSize;

  std::memcpy(&offsetsSize, cursor, 4);
  cursor += 4;
  std::memcpy(&neighborsSize, cursor, 4);
  cursor += 4;
  std::memcpy(&lengthsSize, cursor, 4);
  cursor += 4;
  std::memcpy(&surfacePrimarySize, cursor, 4);
  cursor += 4;
  std::memcpy(&modeMasksSize, cursor, 4);
  cursor += 4;

  // Basic consistency
  if (offsetsSize != header->numNodes + 1 ||
      neighborsSize != header->numEdges || lengthsSize != header->numEdges)
  {
    throw std::runtime_error("lengths block mismatch: " + filePath);
  }
  if (header->hasSurfacePrimary && surfacePrimarySize != header->numEdges)
  {
    throw std::runtime_error("primary length mismatch: " + filePath);
  }
  if (header->hasModeMask && modeMasksSize != header->numEdges)
  {
    throw std::runtime_error("modeMask length mismatch: " + filePath);
  }

  // --- Views ---
  EdgesView edgesView;
  edgesView.hold = mapping;
  edgesView.numNodes = header->numNodes;
  edgesView.numEdges = header->numEdges;

  requireBytes(sizeof(uint32_t) * offsetsSize);
  edgesView.offsets = reinterpret_cast<const uint32_t*>(cursor);
  cursor += sizeof(uint32_t) * offsetsSize;

  requireBytes(sizeof(uint32_t) * neighborsSize);
  edgesView.neighbors = reinterpret_cast<const uint32_t*>(cursor);
  cursor += sizeof(uint32_t) * neighborsSize;

  requireBytes(sizeof(float) * lengthsSize);
  edgesView.lengthsMeters = reinterpret_cast<const float*>(cursor);
  cursor += sizeof(float) * lengthsSize;

  if (header->hasSurfacePrimary)
  {
    requireBytes(sizeof(uint8_t) * surfacePrimarySize);
    edgesView.surfacePrimary = reinterpret_cast<const uint8_t*>(cursor);
    cursor += sizeof(uint8_t) * surfacePrimarySize;
  }

  if (header->hasModeMask)
  {
    requireBytes(sizeof(uint8_t) * modeMasksSize);
    edgesView.modeMask = reinterpret_cast<const uint8_t*>(cursor);
    cursor += sizeof(uint8_t) * modeMasksSize;
  }

  // Required fields sanity
  if (!edgesView.modeMask)
  {
    throw std::runtime_error("edges bin missing modeMask: " + filePath);
  }

  if (edgesView.offsets[0] != 0 ||
      edgesView.offsets[edgesView.numNodes] != edgesView.numEdges)
  {
    throw std::runtime_error("bad CSR offsets: " + filePath);
  }

  return edgesView;
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
  if (auto s = getNum("rideToWalkPenaltyS")) params.rideToWalkPenaltyS = *s;
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
  std::cerr << "started findPath" << std::endl;
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
    glNodes = loadNodes("data/graph_nodes.bin");
    glEdges = loadEdges("data/graph_edges.bin");
    std::cerr << "[route.cpp] loaded numNodes =" << glNodes.numNodes
              << " numEdges =" << glEdges.numEdges << std::endl;

    // mmap tuning hints (optional)
    // ::madvise(const_cast<uint32_t*>(glEdges.offsets),
    //           sizeof(uint32_t) * (glEdges.N + 1), MADV_RANDOM);
    // ::madvise(const_cast<uint32_t*>(glEdges.neighbors),
    //           sizeof(uint32_t) * glEdges.E, MADV_RANDOM);
    // ::madvise(const_cast<float*>(glEdges.lengthsMeters), sizeof(float) *
    // glEdges.E,
    //           MADV_RANDOM);
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
