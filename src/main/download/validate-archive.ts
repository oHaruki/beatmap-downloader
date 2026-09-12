import { addAbortSignal } from "node:stream";
import { crc32 } from "node:zlib";
import { openPromise } from "yauzl";

// Read one entry at a time without extracting files or buffering the archive.
export async function validateArchive(file: string, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const zip = await openPromise(file);
  let total = 0;
  let hasBeatmap = false;
  try {
    for await (const entry of zip.eachEntry()) {
      signal?.throwIfAborted();
      total += entry.uncompressedSize;
      if (total > 4 * 1024 ** 3) throw new Error("expanded archive exceeds 4 GB");
      if (entry.fileName.endsWith("/")) continue;
      const stream = await zip.openReadStreamPromise(entry);
      if (signal) addAbortSignal(signal, stream);
      let checksum = 0;
      for await (const chunk of stream) checksum = crc32(chunk, checksum);
      if (checksum !== entry.crc32) throw new Error("archive checksum mismatch");
      if (/\.osu$/i.test(entry.fileName) && entry.uncompressedSize > 0) hasBeatmap = true;
    }
    if (!hasBeatmap) throw new Error("archive contains no beatmaps");
  } finally {
    zip.close();
  }
}
