const fs = require("fs");
const path = require("path");

const DEFAULT_GRAPH = path.resolve(__dirname, "../data/graph_nodes.bin");
const nodesPath = process.env.GRAPH_NODES
  ? path.resolve(process.env.GRAPH_NODES)
  : DEFAULT_GRAPH;

let TOTAL_NODES = 0;

function readTotalNodes(buf) {
  if (buf.length >= 20 && buf.subarray(0, 8).toString("ascii") === "MMAPNODE") {
    return buf.readUInt32LE(8);
  }
  return undefined;
}

try {
  if (!fs.existsSync(nodesPath)) {
    console.warn(`Graph file not found at ${nodesPath}`);
  } else {
    const nodesBin = fs.readFileSync(nodesPath);
    TOTAL_NODES = readTotalNodes(nodesBin) ?? 0;
    console.log("TOTAL_NODES =", TOTAL_NODES);
  }
} catch (e) {
  console.error("Failed to read graph file:", e?.message || e);
}

function getTotalNodes() {
  return TOTAL_NODES;
}
function getNodesPath() {
  return nodesPath;
}

module.exports = { getTotalNodes, getNodesPath };
