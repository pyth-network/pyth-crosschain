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
}
