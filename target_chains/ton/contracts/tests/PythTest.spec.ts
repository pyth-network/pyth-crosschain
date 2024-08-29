import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Cell, toNano } from "@ton/core";
import "@ton/test-utils";
import { compile } from "@ton/blueprint";
import {
  HexString,
  parseAccumulatorUpdateData,
  Price,
} from "@pythnetwork/price-service-sdk";
import { PythTest, PythTestConfig } from "../wrappers/PythTest";
import { HERMES_BTC_ETH_UPDATE } from "./utils/pyth";

const PRICE_FEED_ID =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
const TIME_PERIOD = 60;
const PRICE = new Price({
  price: "1",
  conf: "2",
  expo: 3,
  publishTime: 4,
});
const EMA_PRICE = new Price({
  price: "5",
  conf: "6",
  expo: 7,
  publishTime: 8,
});
const SINGLE_UPDATE_FEE = 1;

describe("PythTest", () => {
  let code: Cell;

  beforeAll(async () => {
    code = await compile("PythTest");
  });

  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let pythTest: SandboxContract<PythTest>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury("deployer");
  });

  async function deployContract(
    priceFeedId: HexString = PRICE_FEED_ID,
    timePeriod: number = TIME_PERIOD,
    price: Price = PRICE,
    emaPrice: Price = EMA_PRICE,
    singleUpdateFee: number = SINGLE_UPDATE_FEE
  ) {
    const config: PythTestConfig = {
      priceFeedId,
      timePeriod,
      price,
      emaPrice,
      singleUpdateFee,
    };

    pythTest = blockchain.openContract(PythTest.createFromConfig(config, code));

    const deployResult = await pythTest.sendDeploy(
      deployer.getSender(),
      toNano("0.05")
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      deploy: true,
      success: true,
    });
  }

  it("should correctly get price unsafe", async () => {
    await deployContract();

    const result = await pythTest.getPriceUnsafe(PRICE_FEED_ID);
    expect(result.price).toBe(1);
    expect(result.conf).toBe(2);
    expect(result.expo).toBe(3);
    expect(result.publishTime).toBe(4);
  });

  it("should correctly get price no older than", async () => {
    const timeNow = Math.floor(Date.now() / 1000) - TIME_PERIOD + 5; // 5 seconds buffer
    const price = new Price({
      price: "1",
      conf: "2",
      expo: 3,
      publishTime: timeNow,
    });
    await deployContract(PRICE_FEED_ID, TIME_PERIOD, price, EMA_PRICE);

    const result = await pythTest.getPriceNoOlderThan(
      TIME_PERIOD,
      PRICE_FEED_ID
    );

    expect(result.price).toBe(1);
    expect(result.conf).toBe(2);
    expect(result.expo).toBe(3);
    expect(result.publishTime).toBe(timeNow);
  });

  it("should fail to get price no older than", async () => {
    await deployContract();

    await expect(
      pythTest.getPriceNoOlderThan(TIME_PERIOD, PRICE_FEED_ID)
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 1020"); // ERROR_OUTDATED_PRICE = 1020
  });

  it("should correctly get ema price no older than", async () => {
    const timeNow = Math.floor(Date.now() / 1000) - TIME_PERIOD + 5; // 5 seconds buffer
    const emaPrice = new Price({
      price: "5",
      conf: "6",
      expo: 7,
      publishTime: timeNow,
    });
    await deployContract(PRICE_FEED_ID, TIME_PERIOD, PRICE, emaPrice);

    const result = await pythTest.getEmaPriceNoOlderThan(
      TIME_PERIOD,
      PRICE_FEED_ID
    );

    expect(result.price).toBe(5);
    expect(result.conf).toBe(6);
    expect(result.expo).toBe(7);
    expect(result.publishTime).toBe(timeNow);
  });

  it("should fail to get ema price no older than", async () => {
    await deployContract();

    await expect(
      pythTest.getEmaPriceNoOlderThan(TIME_PERIOD, PRICE_FEED_ID)
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 1020"); // ERROR_OUTDATED_PRICE = 1020
  });

  it("should correctly get ema price unsafe", async () => {
    await deployContract();

    const result = await pythTest.getEmaPriceUnsafe(PRICE_FEED_ID);

    expect(result.price).toBe(5);
    expect(result.conf).toBe(6);
    expect(result.expo).toBe(7);
    expect(result.publishTime).toBe(8);
  });

  it("should correctly get update fee", async () => {
    await deployContract();

    const result = await pythTest.getUpdateFee(
      Buffer.from(HERMES_BTC_ETH_UPDATE, "hex")
    );

    expect(result).toBe(2);
  });
});
