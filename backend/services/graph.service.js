const { getGraphInfo: getNativeGraphInfo } = require("./addons.service");

function getGraphInfo() {
  return getNativeGraphInfo();
}

function getTotalNodes() {
  return getGraphInfo()?.numNodes ?? 0;
}
function getNodesPath() {
  return getGraphInfo()?.nodesPath;
}
function getEdgesPath() {
  return getGraphInfo()?.edgesPath;
}

module.exports = { getGraphInfo, getTotalNodes, getNodesPath, getEdgesPath };
