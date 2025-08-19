#!/usr/bin/env bash
set -euo pipefail

./clean.sh

./build.sh

# ./all.sh ../../raw_data/Helsinki.osm.pbf
if [ $# -ne 1 ]; then
  echo "Usage: $0 ../raw_data/<osm.pdf file>"
  exit 1
fi

OSM_PBF="$1"
echo "Running buildGraph …"

cd build
./buildGraph "${OSM_PBF}"

# Deprecated
# echo "Running buildKdTree …"
# ./buildKdTree

echo "All steps complete."
du -ha ../../data | grep -v '/\.DS_Store$'

