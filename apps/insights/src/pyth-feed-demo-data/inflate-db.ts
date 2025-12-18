import fs from "node:fs";
import zlib from "node:zlib";

import { COMPRESSED_DB_PATH, UNCOMPRESSED_DB_PATH } from "./constants";

/**
 * Decompresses the xz-compressed Historical data DB
 * so it's ready to use in the next.js application
 */
export function inflateHistoricalDataDb() {
  return new Promise<void>((resolve, reject) => {
    const decompressor = zlib.createBrotliDecompress();
    const readStream = fs.createReadStream(COMPRESSED_DB_PATH);
    const writeStream = fs.createWriteStream(UNCOMPRESSED_DB_PATH);

    function cleanupHandlers() {
      decompressor.off("error", handleError);
      writeStream.off("error", handleError);
      writeStream.off("finish", handleFinish);
    }
    function handleFinish() {
      cleanupHandlers();
      resolve();
    }
    function handleError(error: Error) {
      cleanupHandlers();
      reject(error);
    }

    decompressor.once("error", handleError);
    writeStream.once("finish", handleFinish);
    writeStream.once("error", handleError);
    readStream.pipe(decompressor).pipe(writeStream);
  });
}
