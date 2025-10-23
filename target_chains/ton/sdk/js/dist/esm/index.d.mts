import { Address, Cell, Contract, Sender } from "@ton/core";
import { ContractProvider } from "@ton/ton";

//#region src/index.d.ts
declare const PYTH_CONTRACT_ADDRESS_MAINNET = "EQBgtfuGIzWLiOzpZO48_psYvco4xRtkAbdbmTwy0_o95LtZ";
declare const PYTH_CONTRACT_ADDRESS_TESTNET = "EQB4ZnrI5qsP_IUJgVJNwEGKLzZWsQOFhiaqDbD7pTt_f9oU";
declare const UPDATE_PRICE_FEEDS_BASE_GAS = 300000n;
declare const UPDATE_PRICE_FEEDS_PER_UPDATE_GAS = 90000n;
declare const GAS_PRICE_FACTOR = 400n;
interface DataSource {
  emitterChain: number;
  emitterAddress: string;
}
declare class PythContract implements Contract {
  readonly address: Address;
  readonly init?: {
    code: Cell;
    data: Cell;
  } | undefined;
  constructor(address: Address, init?: {
    code: Cell;
    data: Cell;
  } | undefined);
  static createFromAddress(address: Address): PythContract;
  getCurrentGuardianSetIndex(provider: ContractProvider): Promise<number>;
  sendUpdateGuardianSet(provider: ContractProvider, via: Sender, vm: Buffer): Promise<void>;
  sendUpdatePriceFeeds(provider: ContractProvider, via: Sender, updateData: Buffer, updateFee: bigint): Promise<void>;
  sendExecuteGovernanceAction(provider: ContractProvider, via: Sender, governanceAction: Buffer): Promise<void>;
  sendUpgradeContract(provider: ContractProvider, via: Sender, newCode: Cell): Promise<void>;
  getPriceUnsafe(provider: ContractProvider, priceFeedId: string): Promise<{
    price: number;
    conf: number;
    expo: number;
    publishTime: number;
  }>;
  getPriceNoOlderThan(provider: ContractProvider, timePeriod: number, priceFeedId: string): Promise<{
    price: number;
    conf: number;
    expo: number;
    publishTime: number;
  }>;
  getEmaPriceUnsafe(provider: ContractProvider, priceFeedId: string): Promise<{
    price: number;
    conf: number;
    expo: number;
    publishTime: number;
  }>;
  getEmaPriceNoOlderThan(provider: ContractProvider, timePeriod: number, priceFeedId: string): Promise<{
    price: number;
    conf: number;
    expo: number;
    publishTime: number;
  }>;
  getUpdateFee(provider: ContractProvider, vm: Buffer): Promise<number>;
  getSingleUpdateFee(provider: ContractProvider): Promise<number>;
  getLastExecutedGovernanceSequence(provider: ContractProvider): Promise<number>;
  getChainId(provider: ContractProvider): Promise<number>;
  getDataSources(provider: ContractProvider): Promise<DataSource[]>;
  getGovernanceDataSource(provider: ContractProvider): Promise<DataSource | null>;
  getGuardianSet(provider: ContractProvider, index: number): Promise<{
    expirationTime: number;
    keys: string[];
    keyCount: number;
  }>;
}
declare function createCellChain(buffer: Buffer): Cell;
declare function parseDataSources(cell: Cell): DataSource[];
declare function parseDataSource(cell: Cell): DataSource | null;
declare function parseGuardianSetKeys(cell: Cell): string[];
declare function calculateUpdatePriceFeedsFee(numUpdates: bigint): bigint;
//#endregion
export { DataSource, GAS_PRICE_FACTOR, PYTH_CONTRACT_ADDRESS_MAINNET, PYTH_CONTRACT_ADDRESS_TESTNET, PythContract, UPDATE_PRICE_FEEDS_BASE_GAS, UPDATE_PRICE_FEEDS_PER_UPDATE_GAS, calculateUpdatePriceFeedsFee, createCellChain, parseDataSource, parseDataSources, parseGuardianSetKeys };
//# sourceMappingURL=index.d.mts.map