import { DataSource } from "@pythnetwork/xc-admin-common";
import { Cell, Transaction, beginCell } from "@ton/core";

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
  if (!lastCell) {
    throw new Error("Failed to create cell chain");
  }
  return lastCell;
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

// Helper function to parse DataSource from a Cell
export function parseDataSource(cell: Cell): DataSource {
  const slice = cell.beginParse();
  const emitterChain = slice.loadUint(16);
  const emitterAddress = slice.loadUint(256).toString(16).padStart(64, "0");
  return { emitterChain, emitterAddress };
}

function computedGeneric(transaction: Transaction) {
  if (transaction.description.type !== "generic")
    throw "Expected generic transactionaction";
  if (transaction.description.computePhase.type !== "vm")
    throw "Compute phase expected";
  return transaction.description.computePhase;
}

export function printTxGasStats(name: string, transaction: Transaction) {
  const txComputed = computedGeneric(transaction);
  console.log(`${name} used ${txComputed.gasUsed} gas`);
  console.log(`${name} gas cost: ${txComputed.gasFees}`);
  return txComputed.gasFees;
}
