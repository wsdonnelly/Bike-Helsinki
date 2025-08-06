#include <boost/geometry.hpp>
#include <boost/geometry/index/rtree.hpp>
#include <cstdint>
#include <fstream>
#include <napi.h>
#include <stdexcept>
#include <vector>
#include <unordered_set>

namespace bg = boost::geometry;
namespace bgi = boost::geometry::index;

// Point type in degrees
using Point = bg::model::point<double, 2, bg::cs::geographic<bg::degree>>;
// (Point, treeIndex)
using Value = std::pair<Point, uint32_t>;

// In-memory storage
static bgi::rtree<Value, bgi::quadratic<16>> tree;
static std::vector<float> kdLat, kdLon;
// Store full dataset for filtering
static std::vector<Value> allKDData;

// kd_nodes.bin format: [uint32 numNodes] [ float32 lat_0, float32 lon_0, uint32 idx_0 ] … repeated
void LoadKD(const std::string& path)
{
    std::ifstream in(path, std::ios::binary);
    if (!in)
    {
        throw std::runtime_error("Could not open KD file: " + path);
    }
    uint32_t numNodes;
    in.read(reinterpret_cast<char*>(&numNodes), sizeof(numNodes));
    if (!in)
    {
        throw std::runtime_error("Failed to read KD header");
    }

    kdLat.resize(numNodes);
    kdLon.resize(numNodes);
    std::vector<Value> data;
    data.reserve(numNodes);

    for (uint32_t i = 0; i < numNodes; ++i)
    {
        float lat, lon;
        uint32_t idx;

        in.read(reinterpret_cast<char*>(&lat), sizeof(lat));
        in.read(reinterpret_cast<char*>(&lon), sizeof(lon));
        in.read(reinterpret_cast<char*>(&idx), sizeof(idx));
        if (!in)
        {
            throw std::runtime_error("Unexpected EOF in KD data");
        }
        kdLat[i] = lat;
        kdLon[i] = lon;
        data.emplace_back(Point{lat, lon}, idx);
    }

    // Store full dataset for later filtering
    allKDData = data;
    // Build the R-tree for nearest-neighbor on full data
    tree = bgi::rtree<Value, bgi::quadratic<16>>(allKDData.begin(), allKDData.end());
}

// Rebuild the R-tree based on a filtered list of node indices
void RebuildKDFromFilter(const std::vector<uint32_t>& allowedIndices)
{
    std::unordered_set<uint32_t> allowedSet(allowedIndices.begin(), allowedIndices.end());
    std::vector<Value> filteredData;
    filteredData.reserve(allowedSet.size());

    for (const auto& val : allKDData)
    {
        // val.second is the original node index
        if (allowedSet.count(val.second))
        {
            filteredData.push_back(val);
        }
    }

    tree = bgi::rtree<Value, bgi::quadratic<16>>(filteredData.begin(), filteredData.end());
}

// findNearest(lat, lon) → treeIndex
Napi::Value FindNearest(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    if (info.Length() != 2 || !info[0].IsNumber() || !info[1].IsNumber())
    {
        Napi::TypeError::New(env, "Expected (number, number)").ThrowAsJavaScriptException();
        return env.Null();
    }
    double lat = info[0].As<Napi::Number>().DoubleValue();
    double lon = info[1].As<Napi::Number>().DoubleValue();

    Point q(lat, lon);
    std::vector<Value> result;
    tree.query(bgi::nearest(q, 1), std::back_inserter(result));
    if (result.empty())
    {
        Napi::Error::New(env, "R-tree is empty or no points match filter").ThrowAsJavaScriptException();
        return env.Null();
    }
    uint32_t treeIdx = result.front().second;
    return Napi::Number::New(env, treeIdx);
}

// getNode(treeIndex) → { nodeIdx, lat, lon }
Napi::Value GetNode(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    if (info.Length() != 1 || !info[0].IsNumber())
    {
        Napi::TypeError::New(env, "Expected (number)").ThrowAsJavaScriptException();
        return env.Null();
    }
    uint32_t idx = info[0].As<Napi::Number>().Uint32Value();
    if (idx >= kdLat.size())
    {
        Napi::RangeError::New(env, "Index out of range").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Object obj = Napi::Object::New(env);
    obj.Set("nodeIdx", idx);
    obj.Set("lat", Napi::Number::New(env, kdLat[idx]));
    obj.Set("lon", Napi::Number::New(env, kdLon[idx]));
    return obj;
}

// filterKD([idx0, idx1, ...]) → void
Napi::Value FilterKD(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    if (info.Length() != 1 || !info[0].IsArray())
    {
        Napi::TypeError::New(env, "Expected (array of node indices)").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Array jsArray = info[0].As<Napi::Array>();
    std::vector<uint32_t> allowedIndices;
    allowedIndices.reserve(jsArray.Length());

    for (uint32_t i = 0; i < jsArray.Length(); ++i)
    {
        Napi::Value val = jsArray[i];
        if (!val.IsNumber())
        {
            Napi::TypeError::New(env, "Array must contain numbers").ThrowAsJavaScriptException();
            return env.Null();
        }
        allowedIndices.push_back(val.As<Napi::Number>().Uint32Value());
    }

    RebuildKDFromFilter(allowedIndices);
    return env.Null();
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    try
    {
        LoadKD("../data/kd_nodes.bin");
    }
    catch (const std::exception& e)
    {
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return exports;
    }

    exports.Set("findNearest", Napi::Function::New(env, FindNearest));
    exports.Set("getNode", Napi::Function::New(env, GetNode));
    exports.Set("filterKD", Napi::Function::New(env, FilterKD));
    return exports;
}

NODE_API_MODULE(kd_snap, Init);
