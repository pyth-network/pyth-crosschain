import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Cell, toNano } from "@ton/core";
import "@ton/test-utils";
import { compile } from "@ton/blueprint";
import { HexString, Price } from "@pythnetwork/price-service-sdk";
import { PythTest, PythTestConfig } from "../wrappers/PythTest";
import { BTC_PRICE_FEED_ID, HERMES_BTC_ETH_UPDATE } from "./utils/pyth";
import { GUARDIAN_SET_0, MAINNET_UPGRADE_VAAS } from "./utils/wormhole";
import { DataSource } from "@pythnetwork/xc-admin-common";

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
const DATA_SOURCES: DataSource[] = [
  {
    emitterChain: 26,
    emitterAddress:
      "e101faedac5851e32b9b23b5f9411a8c2bac4aae3ed4dd7b811dd1a72ea4aa71",
  },
];

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
    priceFeedId: HexString = BTC_PRICE_FEED_ID,
    timePeriod: number = TIME_PERIOD,
    price: Price = PRICE,
    emaPrice: Price = EMA_PRICE,
    singleUpdateFee: number = SINGLE_UPDATE_FEE,
    dataSources: DataSource[] = DATA_SOURCES,
    guardianSetIndex: number = 0,
    guardianSet: string[] = GUARDIAN_SET_0,
    chainId: number = 1,
    governanceChainId: number = 1,
    governanceContract: string = "0000000000000000000000000000000000000000000000000000000000000004"
  ) {
    const config: PythTestConfig = {
      priceFeedId,
      timePeriod,
      price,
      emaPrice,
      singleUpdateFee,
      dataSources,
      guardianSetIndex,
      guardianSet,
      chainId,
      governanceChainId,
      governanceContract,
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

    const result = await pythTest.getPriceUnsafe(BTC_PRICE_FEED_ID);
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
    await deployContract(BTC_PRICE_FEED_ID, TIME_PERIOD, price, EMA_PRICE);

    const result = await pythTest.getPriceNoOlderThan(
      TIME_PERIOD,
      BTC_PRICE_FEED_ID
    );

    expect(result.price).toBe(1);
    expect(result.conf).toBe(2);
    expect(result.expo).toBe(3);
    expect(result.publishTime).toBe(timeNow);
  });

  it("should fail to get price no older than", async () => {
    await deployContract();

    await expect(
      pythTest.getPriceNoOlderThan(TIME_PERIOD, BTC_PRICE_FEED_ID)
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
    await deployContract(BTC_PRICE_FEED_ID, TIME_PERIOD, PRICE, emaPrice);

    const result = await pythTest.getEmaPriceNoOlderThan(
      TIME_PERIOD,
      BTC_PRICE_FEED_ID
    );

    expect(result.price).toBe(5);
    expect(result.conf).toBe(6);
    expect(result.expo).toBe(7);
    expect(result.publishTime).toBe(timeNow);
  });

  it("should fail to get ema price no older than", async () => {
    await deployContract();

    await expect(
      pythTest.getEmaPriceNoOlderThan(TIME_PERIOD, BTC_PRICE_FEED_ID)
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 1020"); // ERROR_OUTDATED_PRICE = 1020
  });

  it("should correctly get ema price unsafe", async () => {
    await deployContract();

    const result = await pythTest.getEmaPriceUnsafe(BTC_PRICE_FEED_ID);

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

  it("should correctly update price feeds", async () => {
    await deployContract();
    let result;

    const mainnet_upgrade_vaa_1 = MAINNET_UPGRADE_VAAS[0];
    result = await pythTest.sendUpdateGuardianSet(
      deployer.getSender(),
      Buffer.from(mainnet_upgrade_vaa_1, "hex")
    );
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    const mainnet_upgrade_vaa_2 = MAINNET_UPGRADE_VAAS[1];
    result = await pythTest.sendUpdateGuardianSet(
      deployer.getSender(),
      Buffer.from(mainnet_upgrade_vaa_2, "hex")
    );
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    const mainnet_upgrade_vaa_3 = MAINNET_UPGRADE_VAAS[2];
    result = await pythTest.sendUpdateGuardianSet(
      deployer.getSender(),
      Buffer.from(mainnet_upgrade_vaa_3, "hex")
    );
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    const mainnet_upgrade_vaa_4 = MAINNET_UPGRADE_VAAS[3];
    result = await pythTest.sendUpdateGuardianSet(
      deployer.getSender(),
      Buffer.from(mainnet_upgrade_vaa_4, "hex")
    );
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    const updateData = Buffer.from(HERMES_BTC_ETH_UPDATE, "hex");
    const updateFee = await pythTest.getUpdateFee(updateData);

    result = await pythTest.sendUpdatePriceFeeds(
      deployer.getSender(),
      updateData,
      toNano(updateFee)
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    // Check if the price has been updated correctly
    const updatedPrice = await pythTest.getPriceUnsafe(BTC_PRICE_FEED_ID);
    expect(updatedPrice.price).not.toBe(Number(PRICE.price)); // Since we updated the price, it should not be the same as the initial price
    expect(updatedPrice.publishTime).toBeGreaterThan(PRICE.publishTime);
  });

  it("should return the correct chain ID", async () => {
    await deployContract();

    const result = await pythTest.getChainId();
    expect(result).toEqual(1);
  });

  it("should return the correct last executed governance sequence", async () => {
    await deployContract();

    const result = await pythTest.getLastExecutedGovernanceSequence();
    expect(result).toEqual(0); // Initial value should be 0

    // TODO: add more tests for other governance sequences
  });

  it("should return the correct governance data source index", async () => {
    await deployContract();

    const result = await pythTest.getGovernanceDataSourceIndex();
    expect(result).toEqual(0); // Initial value should be 0

    // TODO: add more tests for other governance data source index
  });

  it("should return an empty cell for governance data source", async () => {
    await deployContract();

    const result = await pythTest.getGovernanceDataSource();
    // assert that the result is an empty cell initally
    expect(result).toBeDefined();
    expect(result.bits.length).toBe(0);
    expect(result.refs.length).toBe(0);

    // TODO: add more tests for other governance data source
  });
});
