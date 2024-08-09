import { Cell, beginCell } from "@ton/core";

export function createCellChain(buffer: Buffer): Cell {
  let chunks = bufferToChunks(buffer, 127);
  let lastCell: Cell | null = null;
  // Iterate through chunks in reverse order
  for (let i = chunks.length - 1; i >= 0; i--) {
    const chunk = chunks[i];
    const cellBuilder = beginCell();

    cellBuilder.storeBuffer(chunk);

    if (lastCell) {
      cellBuilder.storeRef(lastCell);
    }

    lastCell = cellBuilder.endCell();
  }

  // lastCell will be the root cell of our chain
  const rootCell = lastCell!;
  return rootCell;
}

function bufferToChunks(buff: Buffer, chunkSize: number) {
  let chunks: Buffer[] = [];
  while (buff.byteLength > 0) {
    chunks.push(buff.subarray(0, chunkSize));
    buff = buff.subarray(chunkSize);
  }
  return chunks;
}
