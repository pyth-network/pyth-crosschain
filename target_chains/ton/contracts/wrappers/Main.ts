import { Cell, contractAddress, ContractProvider, Sender } from "@ton/core";
import { HexString } from "@pythnetwork/price-service-sdk";

import { BaseWrapper } from "./BaseWrapper";
import { DataSource } from "@pythnetwork/xc-admin-common";

export type MainConfig = {
  singleUpdateFee: number;
  dataSources: DataSource[];
  guardianSetIndex: number;
  guardianSet: string[];
  chainId: number;
  governanceChainId: number;
  governanceContract: string;
  governanceDataSource?: DataSource;
};

export class Main extends BaseWrapper {
  static createFromConfig(config: MainConfig, code: Cell, workchain = 0) {
    const data = Main.mainConfigToCell(config);
    const init = { code, data };
    return new Main(contractAddress(workchain, init), init);
  }

  static mainConfigToCell(config: MainConfig): Cell {
    return BaseWrapper.createInitData(config);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await super.sendDeploy(provider, via, value);
  }

  async getCurrentGuardianSetIndex(provider: ContractProvider) {
    return await super.getCurrentGuardianSetIndex(
      provider,
      "get_current_guardian_set_index",
    );
  }

  async sendUpdateGuardianSet(
    provider: ContractProvider,
    via: Sender,
    vm: Buffer,
  ) {
    await super.sendUpdateGuardianSet(provider, via, vm);
  }

  async sendUpdatePriceFeeds(
    provider: ContractProvider,
    via: Sender,
    updateData: Buffer,
    updateFee: bigint,
  ) {
    await super.sendUpdatePriceFeeds(provider, via, updateData, updateFee);
  }

  async getPriceUnsafe(provider: ContractProvider, priceFeedId: HexString) {
    return await super.getPriceUnsafe(
      provider,
      priceFeedId,
      "get_price_unsafe",
    );
  }

  async getPriceNoOlderThan(
    provider: ContractProvider,
    timePeriod: number,
    priceFeedId: HexString,
  ) {
    return await super.getPriceNoOlderThan(
      provider,
      timePeriod,
      priceFeedId,
      "get_price_no_older_than",
    );
  }

  async getEmaPriceUnsafe(provider: ContractProvider, priceFeedId: HexString) {
    return await super.getEmaPriceUnsafe(
      provider,
      priceFeedId,
      "get_ema_price_unsafe",
    );
  }

  async getEmaPriceNoOlderThan(
    provider: ContractProvider,
    timePeriod: number,
    priceFeedId: HexString,
  ) {
    return await super.getEmaPriceNoOlderThan(
      provider,
      timePeriod,
      priceFeedId,
      "get_ema_price_no_older_than",
    );
  }

  async getUpdateFee(provider: ContractProvider, vm: Buffer) {
    return await super.getUpdateFee(provider, vm, "get_update_fee");
  }

  async getSingleUpdateFee(provider: ContractProvider) {
    return await super.getSingleUpdateFee(provider, "get_single_update_fee");
  }

  async getChainId(provider: ContractProvider) {
    return await super.getChainId(provider, "get_chain_id");
  }
}
