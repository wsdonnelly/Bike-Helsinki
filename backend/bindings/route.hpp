#pragma once

#include <sys/mman.h>
#include <unistd.h>

#include <cstdint>
#include <memory>
#include <utility>

// ---------------- mmap helpers ----------------
// 1) Make the mapping handle move-only
struct MappedFile
{
  void* base = nullptr;
  size_t size = 0;
  int fileHandle = -1;

  MappedFile() = default;
  MappedFile(const MappedFile&) = delete;
  MappedFile& operator=(const MappedFile&) = delete;

  MappedFile(MappedFile&& other) noexcept
      : base(std::exchange(other.base, nullptr)),
        size(std::exchange(other.size, 0)),
        fileHandle(std::exchange(other.fileHandle, -1))
  {}

  MappedFile& operator=(MappedFile&& other) noexcept
  {
    if (this != &other)
    {
      if (base) ::munmap(base, size);
      if (fileHandle >= 0) ::close(fileHandle);
      base = std::exchange(other.base, nullptr);
      size = std::exchange(other.size, 0);
      fileHandle = std::exchange(other.fileHandle, -1);
    }
    return *this;
  }

  ~MappedFile()
  {
    if (base) ::munmap(base, size);
    if (fileHandle >= 0) ::close(fileHandle);
  }
};

// ---------------- Typed views over the bins ----------------
struct NodesView
{
  std::shared_ptr<MappedFile> hold;  // keep mapping alive
  uint32_t numNodes{0};
  const uint64_t* ids{nullptr};
  const float* lat_f32{nullptr};
  const float* lon_f32{nullptr};
};

struct EdgesView
{
  std::shared_ptr<MappedFile> hold;  // keep mapping alive
  uint32_t numNodes{0};
  uint32_t numEdges{0};
  const uint32_t* offsets{nullptr};        // N+1
  const uint32_t* neighbors{nullptr};      // E
  const float* lengthsMeters{nullptr};     // E
  const uint8_t* surfacePrimary{nullptr};  // E
  const uint8_t* modeMask{nullptr};        // E (bit0=BIKE, bit1=FOOT)
};
