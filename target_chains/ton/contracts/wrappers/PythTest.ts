import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Dictionary,
  Sender,
  SendMode,
  toNano,
} from "@ton/core";
import { HexString, Price } from "@pythnetwork/price-service-sdk";
import { createCellChain } from "../tests/utils";
import { createGuardianSetsDict } from "../tests/utils/wormhole";
import { DataSource } from "@pythnetwork/xc-admin-common";

export type PythTestConfig = {
  priceFeedId: HexString;
  timePeriod: number;
  price: Price;
  emaPrice: Price;
  singleUpdateFee: number;
  dataSources: DataSource[];
  guardianSetIndex: number;
  guardianSet: string[];
  chainId: number;
  governanceChainId: number;
  governanceContract: string;
  governanceDataSource?: DataSource;
};

export class PythTest implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new PythTest(address);
  }

  static createFromConfig(config: PythTestConfig, code: Cell, workchain = 0) {
    const data = PythTest.getPythInitData(
      config.priceFeedId,
      config.timePeriod,
      config.price,
      config.emaPrice,
      config.singleUpdateFee,
      config.dataSources,
      config.guardianSetIndex,
      config.guardianSet,
      config.chainId,
      config.governanceChainId,
      config.governanceContract,
      config.governanceDataSource
    );
    const init = { code, data };
    return new PythTest(contractAddress(workchain, init), init);
  }

  static getPythInitData(
    priceFeedId: HexString,
    timePeriod: number,
    price: Price,
    emaPrice: Price,
    singleUpdateFee: number,
    dataSources: DataSource[],
    guardianSetIndex: number,
    guardianSet: string[],
    chainId: number,
    governanceChainId: number,
    governanceContract: string,
    governanceDataSource?: DataSource
  ): Cell {
    const priceDict = Dictionary.empty(
      Dictionary.Keys.BigUint(256),
      Dictionary.Values.Cell()
    );

    const priceCell = beginCell()
      .storeInt(price.getPriceAsNumberUnchecked() * 10 ** -price.expo, 64)
      .storeUint(price.getConfAsNumberUnchecked() * 10 ** -price.expo, 64)
      .storeInt(price.expo, 32)
      .storeUint(price.publishTime, 64)
      .endCell();

    const emaPriceCell = beginCell()
      .storeInt(emaPrice.getPriceAsNumberUnchecked() * 10 ** -emaPrice.expo, 64)
      .storeUint(emaPrice.getConfAsNumberUnchecked() * 10 ** -emaPrice.expo, 64)
      .storeInt(emaPrice.expo, 32)
      .storeUint(emaPrice.publishTime, 64)
      .endCell();

    const priceFeedCell = beginCell()
      .storeRef(priceCell)
      .storeRef(emaPriceCell)
      .storeUint(timePeriod, 32)
      .endCell();

    priceDict.set(BigInt(priceFeedId), priceFeedCell);

    // Create a dictionary for data sources
    const dataSourcesDict = Dictionary.empty(
      Dictionary.Keys.Uint(32),
      Dictionary.Values.Cell()
    );
    // Create a dictionary for valid data sources
    const isValidDataSourceDict = Dictionary.empty(
      Dictionary.Keys.BigUint(256),
      Dictionary.Values.Bool()
    );

    dataSources.forEach((source, index) => {
      const sourceCell = beginCell()
        .storeUint(source.emitterChain, 16)
        .storeBuffer(Buffer.from(source.emitterAddress, "hex"))
        .endCell();
      dataSourcesDict.set(index, sourceCell);
      const cellHash = BigInt("0x" + sourceCell.hash().toString("hex"));
      isValidDataSourceDict.set(cellHash, true);
    });

    // Group price feeds and update fee
    const priceFeedsCell = beginCell()
      .storeDict(priceDict)
      .storeUint(singleUpdateFee, 256)
      .endCell();

    // Group data sources information
    const dataSourcesCell = beginCell()
      .storeDict(dataSourcesDict)
      .storeUint(dataSources.length, 32)
      .storeDict(isValidDataSourceDict)
      .endCell();

    // Group guardian set information
    const guardianSetCell = beginCell()
      .storeUint(guardianSetIndex, 32)
      .storeDict(createGuardianSetsDict(guardianSet, guardianSetIndex))
      .endCell();

    // Group chain and governance information
    const governanceCell = beginCell()
      .storeUint(chainId, 16)
      .storeUint(governanceChainId, 16)
      .storeBuffer(Buffer.from(governanceContract, "hex"))
      .storeDict(Dictionary.empty()) // consumed_governance_actions
      .storeRef(
        governanceDataSource
          ? beginCell()
              .storeUint(governanceDataSource.emitterChain, 16)
              .storeBuffer(
                Buffer.from(governanceDataSource.emitterAddress, "hex")
              )
              .endCell()
          : beginCell().endCell()
      ) // governance_data_source
      .storeUint(0, 64) // last_executed_governance_sequence
      .storeUint(0, 32) // governance_data_source_index
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

  async getPriceUnsafe(provider: ContractProvider, priceFeedId: HexString) {
    const result = await provider.get("test_get_price_unsafe", [
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
    priceFeedId: HexString
  ) {
    const result = await provider.get("test_get_price_no_older_than", [
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

  async getEmaPriceUnsafe(provider: ContractProvider, priceFeedId: HexString) {
    const result = await provider.get("test_get_ema_price_unsafe", [
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
    priceFeedId: HexString
  ) {
    const result = await provider.get("test_get_ema_price_no_older_than", [
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
    const result = await provider.get("test_get_update_fee", [
      { type: "slice", cell: createCellChain(vm) },
    ]);

    return result.stack.readNumber();
  }

  async getSingleUpdateFee(provider: ContractProvider) {
    const result = await provider.get("test_get_single_update_fee", []);
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

  async sendUpdateGuardianSet(
    provider: ContractProvider,
    via: Sender,
    vm: Buffer
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

  async getChainId(provider: ContractProvider) {
    const result = await provider.get("test_get_chain_id", []);
    return result.stack.readNumber();
  }

  async getLastExecutedGovernanceSequence(provider: ContractProvider) {
    const result = await provider.get(
      "test_get_last_executed_governance_sequence",
      []
    );
    return result.stack.readNumber();
  }

  async getGovernanceDataSourceIndex(provider: ContractProvider) {
    const result = await provider.get(
      "test_get_governance_data_source_index",
      []
    );
    return result.stack.readNumber();
  }

  async getGovernanceDataSource(provider: ContractProvider) {
    const result = await provider.get("test_get_governance_data_source", []);
    return result.stack.readCell();
  }

  async sendExecuteGovernanceAction(
    provider: ContractProvider,
    via: Sender,
    governanceAction: Buffer
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
}
