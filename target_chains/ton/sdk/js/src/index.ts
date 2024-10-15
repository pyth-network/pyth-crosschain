import {
  Address,
  beginCell,
  Cell,
  Contract,
  Sender,
  SendMode,
} from "@ton/core";
import { ContractProvider } from "@ton/ton";

export const PYTH_CONTRACT_ADDRESS_TESTNET =
  "EQDwGkJmcj7MMmWAHmhldnY-lAKI6hcTQ2tAEcapmwCnztQU";

export class PythContract implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new PythContract(address);
  }

  async getCurrentGuardianSetIndex(provider: ContractProvider) {
    const result = await provider.get("get_current_guardian_set_index", []);

    return result.stack.readNumber();
  }

  async sendUpdatePriceFeeds(
    provider: ContractProvider,
    via: Sender,
    updateData: Buffer,
    updateFee: bigint
  ) {
    const messageBody = beginCell()
      .storeUint(2, 32) // OP_UPDATE_PRICE_FEEDS
      .storeRef(createCellChain(updateData))
      .endCell();

    await provider.internal(via, {
      value: updateFee,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }

  async getPriceUnsafe(provider: ContractProvider, priceFeedId: string) {
    const result = await provider.get("get_price_unsafe", [
      { type: "int", value: BigInt(priceFeedId) },
    ]);

    const price = result.stack.readNumber();
    const conf = result.stack.readNumber();
    const expo = result.stack.readNumber();
    const publishTime = result.stack.readNumber();

    return {
      price,
      conf,
      expo,
      publishTime,
    };
  }

  async getPriceNoOlderThan(
    provider: ContractProvider,
    timePeriod: number,
    priceFeedId: string
  ) {
    const result = await provider.get("get_price_no_older_than", [
      { type: "int", value: BigInt(timePeriod) },
      { type: "int", value: BigInt(priceFeedId) },
    ]);

    const price = result.stack.readNumber();
    const conf = result.stack.readNumber();
    const expo = result.stack.readNumber();
    const publishTime = result.stack.readNumber();

    return {
      price,
      conf,
      expo,
      publishTime,
    };
  }

  async getEmaPriceUnsafe(provider: ContractProvider, priceFeedId: string) {
    const result = await provider.get("get_ema_price_unsafe", [
      { type: "int", value: BigInt(priceFeedId) },
    ]);

    const price = result.stack.readNumber();
    const conf = result.stack.readNumber();
    const expo = result.stack.readNumber();
    const publishTime = result.stack.readNumber();

    return {
      price,
      conf,
      expo,
      publishTime,
    };
  }

  async getEmaPriceNoOlderThan(
    provider: ContractProvider,
    timePeriod: number,
    priceFeedId: string
  ) {
    const result = await provider.get("get_ema_price_no_older_than", [
      { type: "int", value: BigInt(timePeriod) },
      { type: "int", value: BigInt(priceFeedId) },
    ]);

    const price = result.stack.readNumber();
    const conf = result.stack.readNumber();
    const expo = result.stack.readNumber();
    const publishTime = result.stack.readNumber();

    return {
      price,
      conf,
      expo,
      publishTime,
    };
  }

  async getUpdateFee(provider: ContractProvider, vm: Buffer) {
    const result = await provider.get("get_update_fee", [
      { type: "slice", cell: createCellChain(vm) },
    ]);

    return result.stack.readNumber();
  }

  async getSingleUpdateFee(provider: ContractProvider) {
    const result = await provider.get("get_single_update_fee", []);

    return result.stack.readNumber();
  }
}

export function createCellChain(buffer: Buffer): Cell {
  const chunks = bufferToChunks(buffer, 127);
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

function bufferToChunks(buff: Buffer, chunkSizeBytes = 127): Uint8Array[] {
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
