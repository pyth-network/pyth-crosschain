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
} from "@ton/core";
import { HexString, Price } from "@pythnetwork/price-service-sdk";
import { createCellChain } from "../tests/utils";

export type PythTestConfig = {
  priceFeedId: HexString;
  timePeriod: number;
  price: Price;
  emaPrice: Price;
  singleUpdateFee: number;
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
      config.singleUpdateFee
    );
    const init = { code, data };
    return new PythTest(contractAddress(workchain, init), init);
  }

  static getPythInitData(
    priceFeedId: HexString,
    timePeriod: number,
    price: Price,
    emaPrice: Price,
    singleUpdateFee: number
  ): Cell {
    const priceDict = Dictionary.empty(
      Dictionary.Keys.BigUint(256),
      Dictionary.Values.Cell()
    );

    const priceCell = beginCell()
      .storeInt(price.getPriceAsNumberUnchecked() * 10 ** -price.expo, 256)
      .storeUint(price.getConfAsNumberUnchecked() * 10 ** -price.expo, 64)
      .storeInt(price.expo, 32)
      .storeUint(price.publishTime, 64)
      .endCell();

    const emaPriceCell = beginCell()
      .storeInt(
        emaPrice.getPriceAsNumberUnchecked() * 10 ** -emaPrice.expo,
        256
      )
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

    return beginCell()
      .storeDict(priceDict) // latest_price_feeds
      .storeUint(singleUpdateFee, 256) // single_update_fee
      .storeUint(0, 32)
      .storeDict(Dictionary.empty())
      .storeUint(0, 16)
      .storeUint(0, 16)
      .storeBuffer(
        Buffer.from(
          "0000000000000000000000000000000000000000000000000000000000000000",
          "hex"
        )
      )
      .storeDict(Dictionary.empty()) // consumed_governance_actions,
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
}
