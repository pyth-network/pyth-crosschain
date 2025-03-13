import {
  Address,
  beginCell,
  Cell,
  Contract,
  Dictionary,
  Sender,
  SendMode,
  toNano,
} from "@ton/core";
import { ContractProvider } from "@ton/ton";

export const PYTH_CONTRACT_ADDRESS_MAINNET =
  "EQBU6k8HH6yX4Jf3d18swWbnYr31D3PJI7PgjXT-flsKHqql";
export const PYTH_CONTRACT_ADDRESS_TESTNET =
  "EQB4ZnrI5qsP_IUJgVJNwEGKLzZWsQOFhiaqDbD7pTt_f9oU";
// This is defined in target_chains/ton/contracts/common/gas.fc
export const UPDATE_PRICE_FEEDS_BASE_GAS = 300000n;
export const UPDATE_PRICE_FEEDS_PER_UPDATE_GAS = 90000n;
// Current settings in basechain are as follows: 1 unit of gas costs 400 nanotons
export const GAS_PRICE_FACTOR = 400n;

export interface DataSource {
  emitterChain: number;
  emitterAddress: string;
}

export class PythContract implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
    return new PythContract(address);
  }

  async getCurrentGuardianSetIndex(provider: ContractProvider) {
    const result = await provider.get("get_current_guardian_set_index", []);

    return result.stack.readNumber();
  }

  async sendUpdateGuardianSet(
    provider: ContractProvider,
    via: Sender,
    vm: Buffer,
  ) {
    const messageBody = beginCell()
      .storeUint(1, 32) // OP_UPDATE_GUARDIAN_SET
      .storeRef(createCellChain(vm))
      .endCell();

    await provider.internal(via, {
      value: toNano("0.1"),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }

  async sendUpdatePriceFeeds(
    provider: ContractProvider,
    via: Sender,
    updateData: Buffer,
    updateFee: bigint,
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

  async sendExecuteGovernanceAction(
    provider: ContractProvider,
    via: Sender,
    governanceAction: Buffer,
  ) {
    const messageBody = beginCell()
      .storeUint(3, 32) // OP_EXECUTE_GOVERNANCE_ACTION
      .storeRef(createCellChain(governanceAction))
      .endCell();

    await provider.internal(via, {
      value: toNano("0.1"),
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: messageBody,
    });
  }

  async sendUpgradeContract(
    provider: ContractProvider,
    via: Sender,
    newCode: Cell,
  ) {
    const messageBody = beginCell()
      .storeUint(4, 32) // OP_UPGRADE_CONTRACT
      .storeRef(newCode)
      .endCell();

    await provider.internal(via, {
      value: toNano("0.1"),
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
    priceFeedId: string,
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
    priceFeedId: string,
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

  async getLastExecutedGovernanceSequence(provider: ContractProvider) {
    const result = await provider.get(
      "get_last_executed_governance_sequence",
      [],
    );

    return result.stack.readNumber();
  }

  async getChainId(provider: ContractProvider) {
    const result = await provider.get("get_chain_id", []);

    return result.stack.readNumber();
  }

  async getDataSources(provider: ContractProvider) {
    const result = await provider.get("get_data_sources", []);
    return parseDataSources(result.stack.readCell());
  }

  async getGovernanceDataSource(provider: ContractProvider) {
    const result = await provider.get("get_governance_data_source", []);
    return parseDataSource(result.stack.readCell());
  }

  async getGuardianSet(provider: ContractProvider, index: number) {
    const result = await provider.get("get_guardian_set", [
      { type: "int", value: BigInt(index) },
    ]);

    const expirationTime = result.stack.readNumber();
    const keys = parseGuardianSetKeys(result.stack.readCell());
    const keyCount = result.stack.readNumber();

    return {
      expirationTime,
      keys,
      keyCount,
    };
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
    buff.byteLength,
  );

  for (let offset = 0; offset < uint8Array.length; offset += chunkSizeBytes) {
    const remainingBytes = Math.min(chunkSizeBytes, uint8Array.length - offset);
    const chunk = uint8Array.subarray(offset, offset + remainingBytes);
    chunks.push(chunk);
  }

  return chunks;
}

export function parseDataSources(cell: Cell): DataSource[] {
  const dataSources: DataSource[] = [];
  const slice = cell.beginParse();
  const dict = slice.loadDictDirect(
    Dictionary.Keys.Uint(8),
    Dictionary.Values.Cell(),
  );
  for (const [, value] of dict) {
    const dataSource = parseDataSource(value);
    if (dataSource) {
      dataSources.push(dataSource);
    }
  }
  return dataSources;
}

export function parseDataSource(cell: Cell): DataSource | null {
  const slice = cell.beginParse();
  if (slice.remainingBits === 0) {
    return null;
  }
  const emitterChain = slice.loadUint(16);
  const emitterAddress = slice.loadUintBig(256).toString(16).padStart(64, "0");
  return { emitterChain, emitterAddress };
}

export function parseGuardianSetKeys(cell: Cell): string[] {
  const keys: string[] = [];

  function parseCell(c: Cell) {
    let slice = c.beginParse();
    while (slice.remainingRefs > 0 || slice.remainingBits >= 160) {
      if (slice.remainingBits >= 160) {
        const bitsToSkip = slice.remainingBits - 160;
        slice = slice.skip(bitsToSkip);
        const key = slice.loadBits(160);
        keys.push("0x" + key.toString());
      }
      if (slice.remainingRefs > 0) {
        parseCell(slice.loadRef());
      }
    }
  }

  parseCell(cell);
  return keys;
}

export function calculateUpdatePriceFeedsFee(numUpdates: bigint) {
  return (
    (UPDATE_PRICE_FEEDS_BASE_GAS +
      UPDATE_PRICE_FEEDS_PER_UPDATE_GAS * numUpdates) *
    GAS_PRICE_FACTOR
  );
}
