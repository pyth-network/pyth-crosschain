import { HexString, Price } from "@pythnetwork/price-service-sdk";
import { DataSource } from "@pythnetwork/xc-admin-common";
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
import { createGuardianSetsDict } from "../tests/utils/wormhole";
import { createCellChain } from "../tests/utils";

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

export class Main implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new Main(address);
  }

  static mainConfigToCell(config: MainConfig): Cell {
    const priceDict = Dictionary.empty(
      Dictionary.Keys.BigUint(256),
      Dictionary.Values.Cell()
    );

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

    config.dataSources.forEach((source, index) => {
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
      .storeUint(config.singleUpdateFee, 256)
      .endCell();

    // Group data sources information
    const dataSourcesCell = beginCell()
      .storeDict(dataSourcesDict)
      .storeUint(config.dataSources.length, 32)
      .storeDict(isValidDataSourceDict)
      .endCell();

    // Group guardian set information
    const guardianSetCell = beginCell()
      .storeUint(config.guardianSetIndex, 32)
      .storeDict(
        createGuardianSetsDict(config.guardianSet, config.guardianSetIndex)
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
                Buffer.from(config.governanceDataSource.emitterAddress, "hex")
              )
              .endCell()
          : beginCell().endCell()
      ) // governance_data_source
      .storeUint(0, 64) // last_executed_governance_sequence, set to 0 for initial state
      .storeUint(0, 32) // governance_data_source_index, set to 0 for initial state
      .storeUint(0, 256) // upgrade_code_hash, set to 0 for initial state
      .endCell();

    return beginCell()
      .storeRef(priceFeedsCell)
      .storeRef(dataSourcesCell)
      .storeRef(guardianSetCell)
      .storeRef(governanceCell)
      .endCell();
  }

  static createFromConfig(config: MainConfig, code: Cell, workchain = 0) {
    const data = Main.mainConfigToCell(config);
    const init = { code, data };
    return new Main(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
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

  async getPriceUnsafe(provider: ContractProvider, priceFeedId: HexString) {
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
    priceFeedId: HexString
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

  async getEmaPriceUnsafe(provider: ContractProvider, priceFeedId: HexString) {
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
    priceFeedId: HexString
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
    console.log("Result:", result);

    return result.stack.readNumber();
  }

  async getSingleUpdateFee(provider: ContractProvider) {
    const result = await provider.get("get_single_update_fee", []);

    return result.stack.readNumber();
  }
}
