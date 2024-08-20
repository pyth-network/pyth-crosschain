import { Cell, beginCell } from "@ton/core";

export function createCellChain(buffer: Buffer): Cell {
  let chunks = bufferToChunks(buffer, 127);
  let lastCell: Cell | null = null;
  // Iterate through chunks in reverse order
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    const cellBuilder = beginCell();
    const buffer = Buffer.from(chunk);
    cellBuilder.storeBuffer(buffer);

    if (lastCell) {
      cellBuilder.storeRef(lastCell);
    }

    lastCell = cellBuilder.endCell();
  }

  // lastCell will be the root cell of our chain
  const rootCell = lastCell!;
  return rootCell;
}

function bufferToChunks(
  buff: Buffer,
  chunkSizeBytes: number = 127
): Uint8Array[] {
  const chunks: Uint8Array[] = [];
  const uint8Array = new Uint8Array(
    buff.buffer,
    buff.byteOffset,
    buff.byteLength
  );

  for (let offset = 0; offset < uint8Array.length; offset += chunkSizeBytes) {
    const remainingBytes = Math.min(chunkSizeBytes, uint8Array.length - offset);
    const chunk = uint8Array.subarray(offset, offset + remainingBytes);
    chunks.push(chunk);
  }

  return chunks;
}
