import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
} from "@ton/core";

export type PythConfig = {};

export function pythConfigToCell(config: PythConfig): Cell {
  return beginCell().endCell();
}

export class Pyth implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new Pyth(address);
  }

  static createFromConfig(config: PythConfig, code: Cell, workchain = 0) {
    const data = pythConfigToCell(config);
    const init = { code, data };
    return new Pyth(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  private static createCellChain(buffer: Buffer): Cell {
    const rootCell = beginCell();
    let currentCell = rootCell;

    for (let i = 0; i < buffer.length; i += 127) {
      const chunk = buffer.subarray(i, i + 127);
      currentCell.storeBuffer(chunk);

      if (i + 127 < buffer.length) {
        const nextCell = beginCell();
        currentCell.storeRef(nextCell);
        currentCell = nextCell;
      }
    }

    return rootCell.endCell();
  }

  // NOTE: the function name has to start with "send" or "get" so that it automatically inserts `provider` as a first argument
  async sendParseEncodedUpgrade(
    provider: ContractProvider,
    currentGuardianSetIndex: number,
    encodedUpgrade: Buffer
  ) {
    const result = await provider.get("parse_encoded_upgrade", [
      { type: "int", value: BigInt(currentGuardianSetIndex) },
      { type: "cell", cell: Pyth.createCellChain(encodedUpgrade) },
    ]);

    return {
      action: result.stack.readNumber(),
      chain: result.stack.readNumber(),
      module: result.stack.readBigNumber(),
      newGuardianSetKeys: result.stack.readCell(),
      newGuardianSetIndex: result.stack.readNumber(),
    };
  }
}
