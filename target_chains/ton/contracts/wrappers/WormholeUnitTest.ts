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
import { createCellChain } from "../tests/utils";

export type WormholeUnitTestConfig = {};

export function pythConfigToCell(config: WormholeUnitTestConfig): Cell {
  return beginCell().endCell();
}

export class WormholeUnitTest implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new WormholeUnitTest(address);
  }

  static createFromConfig(
    config: WormholeUnitTestConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = pythConfigToCell(config);
    const init = { code, data };
    return new WormholeUnitTest(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  // NOTE: the function name has to start with "send" or "get" so that it automatically inserts `provider` as a first argument
  async getParseEncodedUpgrade(
    provider: ContractProvider,
    currentGuardianSetIndex: number,
    encodedUpgrade: Buffer
  ) {
    const result = await provider.get("test_parse_encoded_upgrade", [
      { type: "int", value: BigInt(currentGuardianSetIndex) },
      { type: "slice", cell: createCellChain(encodedUpgrade) },
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
