import {
  Address,
  beginCell,
  Cell,
  Contract,
  ContractProvider,
  Dictionary,
  Sender,
  SendMode,
  toNano,
} from "@ton/core";
import { createCellChain } from "@pythnetwork/pyth-ton-js";
import { createGuardianSetsDict } from "../tests/utils/wormhole";
import { HexString, Price } from "@pythnetwork/price-service-sdk";
import { DataSource } from "@pythnetwork/xc-admin-common";

export class BaseWrapper implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
    return new this(address);
  }

  static createInitData(config: {
    priceFeedId?: HexString;
    price?: Price;
    emaPrice?: Price;
    singleUpdateFee?: number;
    dataSources?: DataSource[];
    guardianSetIndex: number;
    guardianSet: string[];
    chainId: number;
    governanceChainId: number;
    governanceContract: string;
    governanceDataSource?: DataSource;
  }): Cell {
    const priceDict = Dictionary.empty(
      Dictionary.Keys.BigUint(256),
      Dictionary.Values.Cell(),
    );

    if (config.priceFeedId && config.price && config.emaPrice) {
      const priceCell = beginCell()
        .storeInt(
          config.price.getPriceAsNumberUnchecked() * 10 ** -config.price.expo,
          64,
        )
        .storeUint(
          config.price.getConfAsNumberUnchecked() * 10 ** -config.price.expo,
          64,
        )
        .storeInt(config.price.expo, 32)
        .storeUint(config.price.publishTime, 64)
        .endCell();

      const emaPriceCell = beginCell()
        .storeInt(
          config.emaPrice.getPriceAsNumberUnchecked() *
            10 ** -config.emaPrice.expo,
          64,
        )
        .storeUint(
          config.emaPrice.getConfAsNumberUnchecked() *
            10 ** -config.emaPrice.expo,
          64,
        )
        .storeInt(config.emaPrice.expo, 32)
        .storeUint(config.emaPrice.publishTime, 64)
        .endCell();

      const priceFeedCell = beginCell()
        .storeRef(priceCell)
        .storeRef(emaPriceCell)
        .endCell();

      priceDict.set(BigInt(config.priceFeedId), priceFeedCell);
    }

    // Create a dictionary for valid data sources
    const isValidDataSourceDict = Dictionary.empty(
      Dictionary.Keys.BigUint(256),
      Dictionary.Values.Bool(),
    );

    if (config.dataSources) {
      config.dataSources.forEach((source) => {
        const sourceCell = beginCell()
          .storeUint(source.emitterChain, 16)
          .storeBuffer(Buffer.from(source.emitterAddress, "hex"))
          .endCell();
        const cellHash = BigInt("0x" + sourceCell.hash().toString("hex"));
        isValidDataSourceDict.set(cellHash, true);
      });
    }

    // Group price feeds and update fee
    const priceFeedsCell = beginCell()
      .storeDict(priceDict)
      .storeUint(config.singleUpdateFee || 0, 256)
      .endCell();

    // Group data sources information
    const dataSourcesCell = beginCell()
      .storeDict(isValidDataSourceDict)
      .endCell();

    // Group guardian set information
    const guardianSetCell = beginCell()
      .storeUint(config.guardianSetIndex, 32)
      .storeDict(
        createGuardianSetsDict(config.guardianSet, config.guardianSetIndex),
      )
      .endCell();

    // Group chain and governance information
    const governanceCell = beginCell()
      .storeUint(config.chainId, 16)
      .storeUint(config.governanceChainId, 16)
      .storeBuffer(Buffer.from(config.governanceContract, "hex"))
      .storeDict(Dictionary.empty()) // consumed_governance_actions
      .storeRef(
        config.governanceDataSource
          ? beginCell()
              .storeUint(config.governanceDataSource.emitterChain, 16)
              .storeBuffer(
                Buffer.from(config.governanceDataSource.emitterAddress, "hex"),
              )
              .endCell()
          : beginCell().endCell(),
      ) // governance_data_source
      .storeUint(0, 64) // last_executed_governance_sequence, set to 0 for initial state
      .storeUint(0, 32) // governance_data_source_index, set to 0 for initial state
      .storeUint(0, 256) // upgrade_code_hash, set to 0 for initial state
      .endCell();

    // Create the main cell with references to grouped data
    return beginCell()
      .storeRef(priceFeedsCell)
      .storeRef(dataSourcesCell)
      .storeRef(guardianSetCell)
      .storeRef(governanceCell)
      .endCell();
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async getCurrentGuardianSetIndex(
    provider: ContractProvider,
    methodName: string,
  ) {
    const result = await provider.get(methodName, []);
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

  async getChainId(provider: ContractProvider, methodName: string) {
    const result = await provider.get(methodName, []);
    return result.stack.readNumber();
  }

  async getPriceUnsafe(
    provider: ContractProvider,
    priceFeedId: HexString,
    methodName: string,
  ) {
    const result = await provider.get(methodName, [
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
    priceFeedId: HexString,
    methodName: string,
  ) {
    const result = await provider.get(methodName, [
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

  async getEmaPriceUnsafe(
    provider: ContractProvider,
    priceFeedId: HexString,
    methodName: string,
  ) {
    const result = await provider.get(methodName, [
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
    priceFeedId: HexString,
    methodName: string,
  ) {
    const result = await provider.get(methodName, [
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

  async getUpdateFee(
    provider: ContractProvider,
    vm: Buffer,
    methodName: string,
  ) {
    const result = await provider.get(methodName, [
      { type: "slice", cell: createCellChain(vm) },
    ]);

    return result.stack.readNumber();
  }

  async getSingleUpdateFee(provider: ContractProvider, methodName: string) {
    const result = await provider.get(methodName, []);

    return result.stack.readNumber();
  }
}
