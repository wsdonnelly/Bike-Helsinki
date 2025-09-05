cmake_minimum_required(VERSION 3.16)
project(HelBikeIngest LANGUAGES CXX)

# --- C++ config --------------------------------------------------------------
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Nice warnings in Debug/RelWithDebInfo
if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|AppleClang|GNU")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

# Optional LTO in Release if supported
option(ENABLE_LTO "Enable link-time optimization in Release builds" ON)
if(ENABLE_LTO AND CMAKE_BUILD_TYPE STREQUAL "Release")
  include(CheckIPOSupported)
  check_ipo_supported(RESULT _ipo_supported OUTPUT _ipo_msg)
  if(_ipo_supported)
    set(CMAKE_INTERPROCEDURAL_OPTIMIZATION TRUE)
  endif()
endif()

# --- Header-only deps (set these from your machine) --------------------------
# Tip: make them CACHE PATH so you can override from the cmake command line
set(OSMIUM_INCLUDE_DIR    "/Users/willdonnelly/src/libosmium/include" CACHE PATH "Path to libosmium/include")
set(PROTOZERO_INCLUDE_DIR "/Users/willdonnelly/src/protozero/include" CACHE PATH "Path to protozero/include")

# --- Executable --------------------------------------------------------------
set(SOURCES
  buildGraph.cpp
  writeBins.cpp
  wayCollector.cpp
  nodeCollector.cpp
)

set(HEADERS
    writeBins.hpp
    wayCollector.hpp
    nodeCollector.hpp
    surfaceTypes.hpp
    binHeaders.hpp
)

add_executable(buildGraph ${SOURCES} ${HEADERS})

target_include_directories(buildGraph PRIVATE
  ${OSMIUM_INCLUDE_DIR}
  ${PROTOZERO_INCLUDE_DIR}
)

# libosmium uses large files; this define is recommended on some platforms
target_compile_definitions(buildGraph PRIVATE _FILE_OFFSET_BITS=64)

# --- Linking -----------------------------------------------------------------
# Minimal set for reading .osm.pbf via libosmium/protozero; zlib/bzip2/expat are
# used depending on input compression / XML. Link directly for simplicity.
# If you *only* read .pbf, Expat isn’t strictly required, but harmless to keep.
target_link_libraries(buildGraph PRIVATE
  z       # zlib
  bz2     # bzip2
  expat   # Expat XML parser (optional if not reading .osm XML)
)
