#include <boost/graph/adjacency_list.hpp>
#include <boost/graph/dijkstra_shortest_paths.hpp>
#include <cstdint>
#include <fstream>
#include <iostream>
#include <napi.h>
#include <vector>

using Graph = boost::adjacency_list<boost::vecS, boost::vecS, boost::undirectedS, boost::no_property,
                                    boost::property<boost::edge_weight_t, float>>;

// again is static the best way here, does this only create the graph once on load?
// static Graph g;
static Graph graph;
static std::vector<std::pair<float, float>> nodeCoords;
/*
graph_nodes.bin format: [uint32 numNodes] [for i in 0..numNodes-1: uint64 nodeId_i][float32 lat_i][float32 lon_i]

graph_edges.bin format: [uint32 numNodeIds][uint32 edgeCount] [ offsets[0..numNodeIds] (uint32 each) ]
neighbors[0..edgeCount-1] (uint32) ] [ weights[0..edgeCount-1] (float32) ]
*/
void LoadGraph(const std::string& nodesPath, const std::string& edgesPath)
{
    std::ifstream nodesIn(nodesPath, std::ios::binary), edgesIn(edgesPath, std::ios::binary);
    if (!nodesIn && !edgesIn)
    {
        throw std::runtime_error("Could not open nodes or edges file: " + nodesPath + edgesPath);
    }
    // uint32_t N, M;
    uint32_t numNodes, numEdges;
    nodesIn.read(reinterpret_cast<char*>(&numNodes), sizeof(numNodes));
    nodeCoords.resize(numNodes);
    for (uint32_t i{0}; i < numNodes; ++i)
    {
        uint64_t id;
        float lat, lon;
        nodesIn.read(reinterpret_cast<char*>(&id), sizeof(id));
        nodesIn.read(reinterpret_cast<char*>(&lat), sizeof(lat));
        nodesIn.read(reinterpret_cast<char*>(&lon), sizeof(lon));
        nodeCoords[i] = {lat, lon};
    }
    edgesIn.read(reinterpret_cast<char*>(&numNodes), sizeof(numNodes));
    edgesIn.read(reinterpret_cast<char*>(&numEdges), sizeof(numEdges));
    std::vector<uint32_t> offsets(numNodes + 1);
    for (uint32_t i{0}; i <= numNodes; ++i)
    {
        edgesIn.read(reinterpret_cast<char*>(&offsets[i]), 4);
    }
    std::vector<uint32_t> neighbors(numEdges);
    std::vector<float> weights(numEdges);
    for (uint32_t i{0}; i < numEdges; ++i)
    {
        edgesIn.read(reinterpret_cast<char*>(&neighbors[i]), 4);
    }
    for (uint32_t i{0}; i < numEdges; ++i)
    {
        edgesIn.read(reinterpret_cast<char*>(&weights[i]), 4);
    }

    graph = Graph(numNodes);
    for (uint32_t nodeIdx{0}; nodeIdx < numNodes; ++nodeIdx)
    {
        for (uint32_t edgeIdx = offsets[nodeIdx]; edgeIdx < offsets[nodeIdx + 1]; ++edgeIdx)
        {
            boost::add_edge(nodeIdx, neighbors[edgeIdx], weights[edgeIdx], graph);
        }
    }
}

Napi::Value FindPath(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    const auto numNodes = boost::num_vertices(graph);

    // 1) Validate args
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber())
    {
        Napi::TypeError::New(env, "Expected (startIdx: number, endIdx: number)").ThrowAsJavaScriptException();
        return env.Null();
    }
    uint32_t start = info[0].As<Napi::Number>().Uint32Value();
    uint32_t end = info[1].As<Napi::Number>().Uint32Value();

    std::cerr << "[route] FindPath(" << start << ", " << end << ")\n";

    // 2) Bounds check
    if (start >= numNodes || end >= numNodes)
    {
        Napi::RangeError::New(env, "startIdx/endIdx out of range [0.." + std::to_string(numNodes - 1) + "]")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    // 3) Trivial same-node case
    if (start == end)
    {
        Napi::Array single = Napi::Array::New(env, 1);
        Napi::Object obj = Napi::Object::New(env);
        obj.Set("nodeIdx", start);
        obj.Set("lat", nodeCoords[start].first);
        obj.Set("lon", nodeCoords[start].second);
        single.Set((uint32_t)0, obj);
        return single;
    }

    try
    {
        // Run Dijkstra
        std::vector<float> dist(numNodes, std::numeric_limits<float>::infinity());
        std::vector<uint32_t> pred(numNodes);
        for (uint32_t i{0}; i < numNodes; ++i)
            pred[i] = i;

        boost::dijkstra_shortest_paths(graph, start, boost::predecessor_map(&pred[0]).distance_map(&dist[0]));

        // *** NEW: detect unreachable via isinf() ***
        if (std::isinf(dist[end]))
        {
            // no path found
            std::cerr << "[route] no path: dist[" << end << "] is infinite\n";
            // return an empty JS array
            return Napi::Array::New(env, 0);
        }

        // Now safe to reconstruct
        std::vector<uint32_t> path;
        uint32_t v = end;
        while (true)
        {
            path.push_back(v);
            if (v == start)
                break;
            uint32_t p = pred[v];
            // should never happen now
            if (p == v)
            {
                std::cerr << "[route] unexpected broken chain at " << v << "\n";
                return Napi::Array::New(env, 0);
            }
            v = p;
        }
        std::reverse(path.begin(), path.end());

        // Convert to JS array as before
        Napi::Array jsPath = Napi::Array::New(env, path.size());
        for (uint32_t i{0}; i < path.size(); ++i)
        {
            uint32_t idx = path[i];
            Napi::Object obj = Napi::Object::New(env);
            obj.Set("nodeIdx", idx);
            obj.Set("lat", nodeCoords[idx].first);
            obj.Set("lon", nodeCoords[idx].second);
            jsPath.Set(i, obj);
        }
        return jsPath;
    }
    catch (const std::exception& ex)
    {
        std::cerr << "[route] exception: " << ex.what() << "\n";
        Napi::Error::New(env, ex.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    LoadGraph("../data/graph_nodes.bin", "../data/graph_edges.bin");
    exports.Set("findPath", Napi::Function::New(env, FindPath));
    return exports;
}

NODE_API_MODULE(route, Init);
