import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Cell, CommonMessageInfoInternal, toNano } from "@ton/core";
import "@ton/test-utils";
import { compile } from "@ton/blueprint";
import { HexString, Price } from "@pythnetwork/price-service-sdk";
import { PythTest, PythTestConfig } from "../wrappers/PythTest";
import {
  BTC_PRICE_FEED_ID,
  HERMES_BTC_ETH_UPDATE,
  PYTH_SET_DATA_SOURCES,
  PYTH_SET_FEE,
  TEST_GUARDIAN_ADDRESS1,
  PYTH_AUTHORIZE_GOVERNANCE_DATA_SOURCE_TRANSFER,
  PYTH_REQUEST_GOVERNANCE_DATA_SOURCE_TRANSFER,
  TEST_GUARDIAN_ADDRESS2,
  ETH_PRICE_FEED_ID,
  HERMES_BTC_PRICE,
  HERMES_ETH_PRICE,
  HERMES_ETH_PUBLISH_TIME,
  HERMES_BTC_PUBLISH_TIME,
  HERMES_BTC_CONF,
  HERMES_BTC_EXPO,
  HERMES_BTC_EMA_CONF,
  HERMES_BTC_EMA_EXPO,
  HERMES_BTC_EMA_PRICE,
  HERMES_ETH_CONF,
  HERMES_ETH_EMA_CONF,
  HERMES_ETH_EMA_EXPO,
  HERMES_ETH_EMA_PRICE,
  HERMES_ETH_EXPO,
  HERMES_BTC_ETH_UNIQUE_UPDATE,
  HERMES_ETH_UNIQUE_EMA_PRICE,
  HERMES_BTC_UNIQUE_CONF,
  HERMES_BTC_UNIQUE_EMA_CONF,
  HERMES_BTC_UNIQUE_EMA_EXPO,
  HERMES_BTC_UNIQUE_EMA_PRICE,
  HERMES_BTC_UNIQUE_EMA_PUBLISH_TIME,
  HERMES_BTC_UNIQUE_EXPO,
  HERMES_BTC_UNIQUE_PRICE,
  HERMES_BTC_UNIQUE_PUBLISH_TIME,
  HERMES_ETH_UNIQUE_CONF,
  HERMES_ETH_UNIQUE_EMA_CONF,
  HERMES_ETH_UNIQUE_EMA_EXPO,
  HERMES_ETH_UNIQUE_EMA_PUBLISH_TIME,
  HERMES_ETH_UNIQUE_EXPO,
  HERMES_ETH_UNIQUE_PRICE,
  HERMES_ETH_UNIQUE_PUBLISH_TIME,
  HERMES_SOL_TON_PYTH_USDT_UPDATE,
  PYTH_PRICE_FEED_ID,
  SOL_PRICE_FEED_ID,
  TON_PRICE_FEED_ID,
  USDT_PRICE_FEED_ID,
  HERMES_SOL_UNIQUE_PUBLISH_TIME,
  HERMES_SOL_UNIQUE_PRICE,
  HERMES_SOL_UNIQUE_CONF,
  HERMES_SOL_UNIQUE_EXPO,
  HERMES_USDT_UNIQUE_PRICE,
  HERMES_USDT_UNIQUE_EXPO,
  HERMES_USDT_UNIQUE_CONF,
  HERMES_USDT_UNIQUE_PUBLISH_TIME,
} from "./utils/pyth";
import { GUARDIAN_SET_0, MAINNET_UPGRADE_VAAS } from "./utils/wormhole";
import { DataSource } from "@pythnetwork/xc-admin-common";
import { createAuthorizeUpgradePayload } from "./utils";
import {
  UniversalAddress,
  createVAA,
  serialize,
} from "@wormhole-foundation/sdk-definitions";
import { mocks } from "@wormhole-foundation/sdk-definitions/testing";
import { calculateUpdatePriceFeedsFee } from "@pythnetwork/pyth-ton-js";

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
const TEST_GOVERNANCE_DATA_SOURCES: DataSource[] = [
  {
    emitterChain: 1,
    emitterAddress:
      "0000000000000000000000000000000000000000000000000000000000000029",
  },
  {
    emitterChain: 2,
    emitterAddress:
      "000000000000000000000000000000000000000000000000000000000000002b",
  },
  {
    emitterChain: 1,
    emitterAddress:
      "0000000000000000000000000000000000000000000000000000000000000000",
  },
];
const CUSTOM_PAYLOAD = Buffer.from("1234567890abcdef", "hex");

describe("PythTest", () => {
  let code: Cell;

  beforeAll(async () => {
    code = await compile("PythTest");
  });

  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let mockDeployer: SandboxContract<TreasuryContract>;
  let pythTest: SandboxContract<PythTest>;

  beforeEach(async () => {
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury("deployer");
    mockDeployer = await blockchain.treasury("mockDeployer");
  });

  async function deployContract(
    priceFeedId: HexString = BTC_PRICE_FEED_ID,
    price: Price = PRICE,
    emaPrice: Price = EMA_PRICE,
    singleUpdateFee: number = SINGLE_UPDATE_FEE,
    dataSources: DataSource[] = DATA_SOURCES,
    guardianSetIndex: number = 0,
    guardianSet: string[] = GUARDIAN_SET_0,
    chainId: number = 1,
    governanceChainId: number = 1,
    governanceContract: string = "0000000000000000000000000000000000000000000000000000000000000004",
    governanceDataSource?: DataSource,
  ) {
    const config: PythTestConfig = {
      priceFeedId,
      price,
      emaPrice,
      singleUpdateFee,
      dataSources,
      guardianSetIndex,
      guardianSet,
      chainId,
      governanceChainId,
      governanceContract,
      governanceDataSource,
    };

    pythTest = blockchain.openContract(PythTest.createFromConfig(config, code));

    const deployResult = await pythTest.sendDeploy(
      deployer.getSender(),
      toNano("0.05"),
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      deploy: true,
      success: true,
    });
  }

  async function updateGuardianSets(
    pythTest: SandboxContract<PythTest>,
    deployer: SandboxContract<TreasuryContract>,
  ) {
    for (const vaa of MAINNET_UPGRADE_VAAS) {
      const result = await pythTest.sendUpdateGuardianSet(
        deployer.getSender(),
        Buffer.from(vaa, "hex"),
      );
      expect(result.transactions).toHaveTransaction({
        from: deployer.address,
        to: pythTest.address,
        success: true,
      });
    }
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
    await deployContract(BTC_PRICE_FEED_ID, price, EMA_PRICE);

    const result = await pythTest.getPriceNoOlderThan(
      TIME_PERIOD,
      BTC_PRICE_FEED_ID,
    );

    expect(result.price).toBe(1);
    expect(result.conf).toBe(2);
    expect(result.expo).toBe(3);
    expect(result.publishTime).toBe(timeNow);
  });

  it("should fail to get price no older than", async () => {
    await deployContract();

    await expect(
      pythTest.getPriceNoOlderThan(TIME_PERIOD, BTC_PRICE_FEED_ID),
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 2001"); // ERROR_OUTDATED_PRICE = 2001
  });

  it("should correctly get ema price no older than", async () => {
    const timeNow = Math.floor(Date.now() / 1000) - TIME_PERIOD + 5; // 5 seconds buffer
    const emaPrice = new Price({
      price: "5",
      conf: "6",
      expo: 7,
      publishTime: timeNow,
    });
    await deployContract(BTC_PRICE_FEED_ID, PRICE, emaPrice);

    const result = await pythTest.getEmaPriceNoOlderThan(
      TIME_PERIOD,
      BTC_PRICE_FEED_ID,
    );

    expect(result.price).toBe(5);
    expect(result.conf).toBe(6);
    expect(result.expo).toBe(7);
    expect(result.publishTime).toBe(timeNow);
  });

  it("should fail to get ema price no older than", async () => {
    await deployContract();

    await expect(
      pythTest.getEmaPriceNoOlderThan(TIME_PERIOD, BTC_PRICE_FEED_ID),
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 2001"); // ERROR_OUTDATED_PRICE = 2001
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
      Buffer.from(HERMES_BTC_ETH_UPDATE, "hex"),
    );

    expect(result).toBe(2);
  });

  it("should correctly update price feeds", async () => {
    await deployContract();
    let result;

    await updateGuardianSets(pythTest, deployer);

    // Check initial prices
    const initialBtcPrice = await pythTest.getPriceUnsafe(BTC_PRICE_FEED_ID);
    expect(initialBtcPrice.price).not.toBe(HERMES_BTC_PRICE);
    // Expect an error for ETH price feed as it doesn't exist initially
    await expect(pythTest.getPriceUnsafe(ETH_PRICE_FEED_ID)).rejects.toThrow(
      "Unable to execute get method. Got exit_code: 2000",
    ); // ERROR_PRICE_FEED_NOT_FOUND = 2000

    const updateData = Buffer.from(HERMES_BTC_ETH_UPDATE, "hex");
    const updateFee = await pythTest.getUpdateFee(updateData);

    result = await pythTest.sendUpdatePriceFeeds(
      deployer.getSender(),
      updateData,
      toNano(updateFee),
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    // Check if both BTC and ETH prices have been updated
    const updatedBtcPrice = await pythTest.getPriceUnsafe(BTC_PRICE_FEED_ID);
    expect(updatedBtcPrice.price).toBe(HERMES_BTC_PRICE);
    expect(updatedBtcPrice.publishTime).toBe(HERMES_BTC_PUBLISH_TIME);

    const updatedEthPrice = await pythTest.getPriceUnsafe(ETH_PRICE_FEED_ID);
    expect(updatedEthPrice.price).toBe(HERMES_ETH_PRICE);
    expect(updatedEthPrice.publishTime).toBe(HERMES_ETH_PUBLISH_TIME);
  });

  it("should fail to get update fee with invalid data", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const invalidUpdateData = Buffer.from("invalid data");

    await expect(pythTest.getUpdateFee(invalidUpdateData)).rejects.toThrow(
      "Unable to execute get method. Got exit_code: 2002",
    ); // ERROR_INVALID_MAGIC = 2002
  });

  it("should fail to update price feeds with invalid data", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const invalidUpdateData = Buffer.from("invalid data");

    // Use a fixed value for updateFee since we can't get it from getUpdateFee
    const updateFee = toNano("0.1"); // Use a reasonable amount

    const result = await pythTest.sendUpdatePriceFeeds(
      deployer.getSender(),
      invalidUpdateData,
      updateFee,
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: false,
      exitCode: 2002, // ERROR_INVALID_MAGIC
    });
  });

  it("should fail to update price feeds with outdated guardian set", async () => {
    await deployContract();
    // Don't update guardian sets

    const updateData = Buffer.from(HERMES_BTC_ETH_UPDATE, "hex");
    const updateFee = await pythTest.getUpdateFee(updateData);

    const result = await pythTest.sendUpdatePriceFeeds(
      deployer.getSender(),
      updateData,
      toNano(updateFee),
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: false,
      exitCode: 1002, // ERROR_GUARDIAN_SET_NOT_FOUND
    });
  });

  it("should fail to update price feeds with invalid data source", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      [], // Empty data sources
    );
    await updateGuardianSets(pythTest, deployer);

    const updateData = Buffer.from(HERMES_BTC_ETH_UPDATE, "hex");
    const updateFee = await pythTest.getUpdateFee(updateData);

    const result = await pythTest.sendUpdatePriceFeeds(
      deployer.getSender(),
      updateData,
      toNano(updateFee),
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: false,
      exitCode: 2005, // ERROR_UPDATE_DATA_SOURCE_NOT_FOUND
    });
  });

  it("should correctly handle stale prices", async () => {
    const staleTime = Math.floor(Date.now() / 1000) - TIME_PERIOD - 10; // 10 seconds past the allowed period
    const stalePrice = new Price({
      price: "1",
      conf: "2",
      expo: 3,
      publishTime: staleTime,
    });
    await deployContract(BTC_PRICE_FEED_ID, stalePrice, EMA_PRICE);

    await expect(
      pythTest.getPriceNoOlderThan(TIME_PERIOD, BTC_PRICE_FEED_ID),
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 2001"); // ERROR_OUTDATED_PRICE = 2001
  });

  it("should fail to update price feeds with insufficient gas", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const updateData = Buffer.from(HERMES_BTC_ETH_UPDATE, "hex");

    let result = await pythTest.sendUpdatePriceFeeds(
      deployer.getSender(),
      updateData,
      calculateUpdatePriceFeedsFee(1n), // Send enough gas for 1 update instead of 2
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: false,
      exitCode: 3000, // ERROR_INSUFFICIENT_GAS
    });
  });

  it("should fail to update price feeds with insufficient fee", async () => {
    await deployContract();

    await updateGuardianSets(pythTest, deployer);

    const updateData = Buffer.from(HERMES_BTC_ETH_UPDATE, "hex");
    const updateFee = await pythTest.getUpdateFee(updateData);

    // Send less than the required fee
    const insufficientFee = updateFee - 1;

    const result = await pythTest.sendUpdatePriceFeeds(
      deployer.getSender(),
      updateData,
      calculateUpdatePriceFeedsFee(2n) + BigInt(insufficientFee),
    );

    // Check that the transaction did not succeed
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: false,
      exitCode: 2011, // ERROR_INSUFFICIENT_FEE = 2011
    });
  });

  it("should fail to get prices for non-existent price feed", async () => {
    await deployContract();

    const nonExistentPriceFeedId =
      "0000000000000000000000000000000000000000000000000000000000000000";

    await expect(
      pythTest.getPriceUnsafe(nonExistentPriceFeedId),
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 2000"); // ERROR_PRICE_FEED_NOT_FOUND = 2000

    await expect(
      pythTest.getPriceNoOlderThan(TIME_PERIOD, nonExistentPriceFeedId),
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 2000"); // ERROR_PRICE_FEED_NOT_FOUND

    await expect(
      pythTest.getEmaPriceUnsafe(nonExistentPriceFeedId),
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 2000"); // ERROR_PRICE_FEED_NOT_FOUND
  });

  it("should correctly get chain ID", async () => {
    await deployContract();

    const result = await pythTest.getChainId();
    expect(result).toEqual(1);
  });

  it("should correctly get last executed governance sequence", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      DATA_SOURCES,
      0,
      [TEST_GUARDIAN_ADDRESS1],
      60051,
      1,
      "0000000000000000000000000000000000000000000000000000000000000004",
      TEST_GOVERNANCE_DATA_SOURCES[0],
    );

    // Check initial value
    let result = await pythTest.getLastExecutedGovernanceSequence();
    expect(result).toEqual(0);

    // Execute a governance action (e.g., set fee)
    await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_FEE, "hex"),
    );

    // Check that the sequence has increased
    result = await pythTest.getLastExecutedGovernanceSequence();
    expect(result).toEqual(1);
  });

  it("should correctly get governance data source index", async () => {
    // Deploy contract with initial governance data source
    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      DATA_SOURCES,
      0,
      [TEST_GUARDIAN_ADDRESS1],
      60051,
      1,
      "0000000000000000000000000000000000000000000000000000000000000004",
      TEST_GOVERNANCE_DATA_SOURCES[0],
    );

    // Check initial value
    let result = await pythTest.getGovernanceDataSourceIndex();
    expect(result).toEqual(0);

    // Execute governance action to change data source
    await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_AUTHORIZE_GOVERNANCE_DATA_SOURCE_TRANSFER, "hex"),
    );

    // Check that the index has increased
    result = await pythTest.getGovernanceDataSourceIndex();
    expect(result).toEqual(1);
  });

  it("should correctly get governance data source", async () => {
    // Deploy contract without initial governance data source
    await deployContract();

    // Check initial value (should be empty)
    let result = await pythTest.getGovernanceDataSource();
    expect(result).toEqual(null);

    // Deploy contract with initial governance data source
    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      DATA_SOURCES,
      0,
      [TEST_GUARDIAN_ADDRESS1],
      60051,
      1,
      "0000000000000000000000000000000000000000000000000000000000000004",
      TEST_GOVERNANCE_DATA_SOURCES[0],
    );

    // Check that the governance data source is set
    result = await pythTest.getGovernanceDataSource();
    expect(result).toEqual(TEST_GOVERNANCE_DATA_SOURCES[0]);

    // Execute governance action to change data source
    await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_AUTHORIZE_GOVERNANCE_DATA_SOURCE_TRANSFER, "hex"),
    );

    // Check that the data source has changed
    result = await pythTest.getGovernanceDataSource();
    expect(result).toEqual(TEST_GOVERNANCE_DATA_SOURCES[1]);
  });

  it("should correctly get single update fee", async () => {
    await deployContract();

    // Get the initial fee
    const result = await pythTest.getSingleUpdateFee();

    expect(result).toBe(SINGLE_UPDATE_FEE);
  });

  it("should execute set data sources governance instruction", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      DATA_SOURCES,
      0,
      [TEST_GUARDIAN_ADDRESS1],
      60051, // CHAIN_ID of starknet since we are using the test payload for starknet
      1,
      "0000000000000000000000000000000000000000000000000000000000000004",
      TEST_GOVERNANCE_DATA_SOURCES[0],
    );

    // Execute the governance action
    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_DATA_SOURCES, "hex"),
    );
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    // Verify that the new data sources are set correctly
    const newDataSources: DataSource[] = [
      {
        emitterChain: 1,
        emitterAddress:
          "6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25",
      },
      {
        emitterChain: 3,
        emitterAddress:
          "000000000000000000000000000000000000000000000000000000000000012d",
      },
    ];

    for (const dataSource of newDataSources) {
      const isValid = await pythTest.getIsValidDataSource(dataSource);
      expect(isValid).toBe(true);
    }

    // Verify that the old data source is no longer valid
    const oldDataSource = DATA_SOURCES[0];
    const oldDataSourceIsValid =
      await pythTest.getIsValidDataSource(oldDataSource);
    expect(oldDataSourceIsValid).toBe(false);
  });

  it("should execute set fee governance instruction", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      DATA_SOURCES,
      0,
      [TEST_GUARDIAN_ADDRESS1],
      60051, // CHAIN_ID of starknet since we are using the test payload for starknet
      1,
      "0000000000000000000000000000000000000000000000000000000000000004",
      TEST_GOVERNANCE_DATA_SOURCES[0],
    );

    // Get the initial fee
    const initialFee = await pythTest.getSingleUpdateFee();
    expect(initialFee).toBe(SINGLE_UPDATE_FEE);

    // Execute the governance action
    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_FEE, "hex"),
    );
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    // Get the new fee
    const newFee = await pythTest.getSingleUpdateFee();
    expect(newFee).toBe(4200); // The new fee value is 4200 in the PYTH_SET_FEE payload

    // Verify that the new fee is used for updates
    const updateData = Buffer.from(HERMES_BTC_ETH_UPDATE, "hex");
    const updateFee = await pythTest.getUpdateFee(updateData);
    expect(updateFee).toBe(8400); // There are two price updates in HERMES_BTC_ETH_UPDATE
  });

  it("should execute authorize governance data source transfer", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      DATA_SOURCES,
      0,
      [TEST_GUARDIAN_ADDRESS1],
      60051, // CHAIN_ID of starknet since we are using the test payload for starknet
      1,
      "0000000000000000000000000000000000000000000000000000000000000004",
      TEST_GOVERNANCE_DATA_SOURCES[0],
    );

    // Get the initial governance data source index
    const initialIndex = await pythTest.getGovernanceDataSourceIndex();
    expect(initialIndex).toEqual(0); // Initial value should be 0

    // Get the initial governance data source
    const initialDataSource = await pythTest.getGovernanceDataSource();
    expect(initialDataSource).toEqual(TEST_GOVERNANCE_DATA_SOURCES[0]);

    // Get the initial last executed governance sequence
    const initialSequence = await pythTest.getLastExecutedGovernanceSequence();
    expect(initialSequence).toEqual(0); // Initial value should be 0

    // Execute the governance action
    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_AUTHORIZE_GOVERNANCE_DATA_SOURCE_TRANSFER, "hex"),
    );
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    // Get the new governance data source index
    const newIndex = await pythTest.getGovernanceDataSourceIndex();
    expect(newIndex).toEqual(1); // The new index value should match the one in the test payload

    // Get the new governance data source
    const newDataSource = await pythTest.getGovernanceDataSource();
    expect(newDataSource).not.toEqual(initialDataSource); // The data source should have changed
    expect(newDataSource).toEqual(TEST_GOVERNANCE_DATA_SOURCES[1]); // The data source should have changed

    // Get the new last executed governance sequence
    const newSequence = await pythTest.getLastExecutedGovernanceSequence();
    expect(newSequence).toBeGreaterThan(initialSequence); // The sequence should have increased
    expect(newSequence).toBe(1);
  });

  it("should fail when executing request governance data source transfer directly", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      DATA_SOURCES,
      0,
      [TEST_GUARDIAN_ADDRESS1],
      60051, // CHAIN_ID of starknet since we are using the test payload for starknet
      1,
      "0000000000000000000000000000000000000000000000000000000000000004",
      TEST_GOVERNANCE_DATA_SOURCES[1],
    );

    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_REQUEST_GOVERNANCE_DATA_SOURCE_TRANSFER, "hex"),
    );

    // Check that the transaction did not succeed
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: false,
      exitCode: 1012, // ERROR_INVALID_GOVERNANCE_ACTION
    });

    // Verify that the governance data source index hasn't changed
    const index = await pythTest.getGovernanceDataSourceIndex();
    expect(index).toEqual(0); // Should still be the initial value

    // Verify that the governance data source hasn't changed
    const dataSource = await pythTest.getGovernanceDataSource();
    expect(dataSource).toEqual(TEST_GOVERNANCE_DATA_SOURCES[1]); // Should still be the initial value
  });

  it("should fail to execute governance action with invalid governance data source", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      DATA_SOURCES,
      0,
      [TEST_GUARDIAN_ADDRESS1],
      60051,
      1,
      "0000000000000000000000000000000000000000000000000000000000000004",
      TEST_GOVERNANCE_DATA_SOURCES[1],
    );

    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_FEE, "hex"),
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: false,
      exitCode: 2013, // ERROR_INVALID_GOVERNANCE_DATA_SOURCE
    });
  });

  it("should fail to execute governance action with old sequence number", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      DATA_SOURCES,
      0,
      [TEST_GUARDIAN_ADDRESS1],
      60051,
      1,
      "0000000000000000000000000000000000000000000000000000000000000004",
      TEST_GOVERNANCE_DATA_SOURCES[0],
    );

    // Execute a governance action to increase the sequence number
    await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_FEE, "hex"),
    );

    // Try to execute the same governance action again
    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_FEE, "hex"),
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: false,
      exitCode: 2014, // ERROR_OLD_GOVERNANCE_MESSAGE
    });
  });

  it("should fail to execute governance action with invalid chain ID", async () => {
    const invalidChainId = 999;
    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      DATA_SOURCES,
      0,
      [TEST_GUARDIAN_ADDRESS1],
      invalidChainId,
      1,
      "0000000000000000000000000000000000000000000000000000000000000004",
      TEST_GOVERNANCE_DATA_SOURCES[0],
    );

    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_FEE, "hex"),
    );

    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: false,
      exitCode: 2015, // ERROR_INVALID_GOVERNANCE_TARGET
    });
  });

  it("should successfully upgrade the contract", async () => {
    // Compile the upgraded contract
    const upgradedCode = await compile("PythTestUpgraded");
    const upgradedCodeHash = upgradedCode.hash();

    // Create the authorize upgrade payload
    const authorizeUpgradePayload =
      createAuthorizeUpgradePayload(upgradedCodeHash);

    const authorizeUpgradeVaa = createVAA("Uint8Array", {
      guardianSet: 0,
      timestamp: 0,
      nonce: 0,
      emitterChain: "Solana",
      emitterAddress: new UniversalAddress(new Uint8Array(32)),
      sequence: 1n,
      consistencyLevel: 0,
      signatures: [],
      payload: authorizeUpgradePayload,
    });

    const guardianSet = mocks.devnetGuardianSet();
    guardianSet.setSignatures(authorizeUpgradeVaa);

    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      DATA_SOURCES,
      0,
      [TEST_GUARDIAN_ADDRESS2],
      1,
      1,
      "0000000000000000000000000000000000000000000000000000000000000000",
      TEST_GOVERNANCE_DATA_SOURCES[2],
    );

    // Execute the upgrade
    const sendExecuteGovernanceActionResult =
      await pythTest.sendExecuteGovernanceAction(
        deployer.getSender(),
        Buffer.from(serialize(authorizeUpgradeVaa)),
      );

    expect(sendExecuteGovernanceActionResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    // Execute the upgrade
    const sendUpgradeContractResult = await pythTest.sendUpgradeContract(
      deployer.getSender(),
      upgradedCode,
    );

    expect(sendUpgradeContractResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    // Verify that the contract has been upgraded by calling a new method
    const newMethodResult = await pythTest.getNewFunction();
    expect(newMethodResult).toBe(1);
  });

  it("should fail to upgrade the contract with modified code", async () => {
    // Compile the upgraded contract
    const upgradedCode = await compile("PythTestUpgraded");
    const upgradedCodeHash = upgradedCode.hash();

    // Create the authorize upgrade payload
    const authorizeUpgradePayload =
      createAuthorizeUpgradePayload(upgradedCodeHash);

    const authorizeUpgradeVaa = createVAA("Uint8Array", {
      guardianSet: 0,
      timestamp: 0,
      nonce: 0,
      emitterChain: "Solana",
      emitterAddress: new UniversalAddress(new Uint8Array(32)),
      sequence: 1n,
      consistencyLevel: 0,
      signatures: [],
      payload: authorizeUpgradePayload,
    });

    const guardianSet = mocks.devnetGuardianSet();
    guardianSet.setSignatures(authorizeUpgradeVaa);

    await deployContract(
      BTC_PRICE_FEED_ID,
      PRICE,
      EMA_PRICE,
      SINGLE_UPDATE_FEE,
      DATA_SOURCES,
      0,
      [TEST_GUARDIAN_ADDRESS2],
      1,
      1,
      "0000000000000000000000000000000000000000000000000000000000000000",
      TEST_GOVERNANCE_DATA_SOURCES[2],
    );

    // Execute the upgrade authorization
    const sendExecuteGovernanceActionResult =
      await pythTest.sendExecuteGovernanceAction(
        deployer.getSender(),
        Buffer.from(serialize(authorizeUpgradeVaa)),
      );

    expect(sendExecuteGovernanceActionResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    // Attempt to execute the upgrade with a different code
    const wormholeTestCode = await compile("WormholeTest");
    const sendUpgradeContractResult = await pythTest.sendUpgradeContract(
      deployer.getSender(),
      wormholeTestCode,
    );

    // Expect the transaction to fail
    expect(sendUpgradeContractResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: false,
      exitCode: 2018, // ERROR_INVALID_CODE_HASH
    });

    // Verify that the contract has not been upgraded by attempting to call the new method
    await expect(pythTest.getNewFunction()).rejects.toThrow();
  });

  it("should successfully parse price feed updates", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const sentValue = toNano("1");
    const result = await pythTest.sendParsePriceFeedUpdates(
      deployer.getSender(),
      Buffer.from(HERMES_BTC_ETH_UPDATE, "hex"),
      sentValue,
      [BTC_PRICE_FEED_ID, ETH_PRICE_FEED_ID],
      HERMES_BTC_PUBLISH_TIME,
      HERMES_BTC_PUBLISH_TIME,
      deployer.address,
      CUSTOM_PAYLOAD,
    );

    // Verify transaction success and message count
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
      outMessagesCount: 1,
    });

    // Get the output message
    const outMessage = result.transactions[1].outMessages.values()[0];

    // Verify excess value is returned
    expect(
      (outMessage.info as CommonMessageInfoInternal).value.coins,
    ).toBeGreaterThan(0);

    const cs = outMessage.body.beginParse();

    // Verify message header
    const op = cs.loadUint(32);
    expect(op).toBe(5); // OP_PARSE_PRICE_FEED_UPDATES

    // Verify number of price feeds
    const numPriceFeeds = cs.loadUint(8);
    expect(numPriceFeeds).toBe(2); // We expect BTC and ETH price feeds

    // Load and verify price feeds
    const priceFeedsCell = cs.loadRef();
    let currentCell = priceFeedsCell;

    // First price feed (BTC)
    const btcCs = currentCell.beginParse();
    const btcPriceId =
      "0x" + btcCs.loadUintBig(256).toString(16).padStart(64, "0");
    expect(btcPriceId).toBe(BTC_PRICE_FEED_ID);

    const btcPriceFeedCell = btcCs.loadRef();
    const btcPriceFeedSlice = btcPriceFeedCell.beginParse();

    // Verify BTC current price
    const btcCurrentPriceCell = btcPriceFeedSlice.loadRef();
    const btcCurrentPrice = btcCurrentPriceCell.beginParse();
    expect(btcCurrentPrice.loadInt(64)).toBe(HERMES_BTC_PRICE);
    expect(btcCurrentPrice.loadUint(64)).toBe(HERMES_BTC_CONF);
    expect(btcCurrentPrice.loadInt(32)).toBe(HERMES_BTC_EXPO);
    expect(btcCurrentPrice.loadUint(64)).toBe(HERMES_BTC_PUBLISH_TIME);

    // Verify BTC EMA price
    const btcEmaPriceCell = btcPriceFeedSlice.loadRef();
    const btcEmaPrice = btcEmaPriceCell.beginParse();
    expect(btcEmaPrice.loadInt(64)).toBe(HERMES_BTC_EMA_PRICE);
    expect(btcEmaPrice.loadUint(64)).toBe(HERMES_BTC_EMA_CONF);
    expect(btcEmaPrice.loadInt(32)).toBe(HERMES_BTC_EMA_EXPO);
    expect(btcEmaPrice.loadUint(64)).toBe(HERMES_BTC_PUBLISH_TIME);

    // Move to ETH price feed
    currentCell = btcCs.loadRef();

    // Second price feed (ETH)
    const ethCs = currentCell.beginParse();
    const ethPriceId =
      "0x" + ethCs.loadUintBig(256).toString(16).padStart(64, "0");
    expect(ethPriceId).toBe(ETH_PRICE_FEED_ID);

    const ethPriceFeedCell = ethCs.loadRef();
    const ethPriceFeedSlice = ethPriceFeedCell.beginParse();

    // Verify ETH current price
    const ethCurrentPriceCell = ethPriceFeedSlice.loadRef();
    const ethCurrentPrice = ethCurrentPriceCell.beginParse();
    expect(ethCurrentPrice.loadInt(64)).toBe(HERMES_ETH_PRICE);
    expect(ethCurrentPrice.loadUint(64)).toBe(HERMES_ETH_CONF);
    expect(ethCurrentPrice.loadInt(32)).toBe(HERMES_ETH_EXPO);
    expect(ethCurrentPrice.loadUint(64)).toBe(HERMES_ETH_PUBLISH_TIME);

    // Verify ETH EMA price
    const ethEmaPriceCell = ethPriceFeedSlice.loadRef();
    const ethEmaPrice = ethEmaPriceCell.beginParse();
    expect(ethEmaPrice.loadInt(64)).toBe(HERMES_ETH_EMA_PRICE);
    expect(ethEmaPrice.loadUint(64)).toBe(HERMES_ETH_EMA_CONF);
    expect(ethEmaPrice.loadInt(32)).toBe(HERMES_ETH_EMA_EXPO);
    expect(ethEmaPrice.loadUint(64)).toBe(HERMES_ETH_PUBLISH_TIME);

    // Verify this is the end of the chain
    expect(ethCs.remainingRefs).toBe(0);

    // Verify sender address
    const senderAddress = cs.loadAddress();
    expect(senderAddress?.toString()).toBe(
      deployer.getSender().address.toString(),
    );

    // Verify custom payload
    const customPayloadCell = cs.loadRef();
    const customPayloadSlice = customPayloadCell.beginParse();
    const receivedPayload = Buffer.from(
      customPayloadSlice.loadBuffer(CUSTOM_PAYLOAD.length),
    );
    expect(receivedPayload.toString("hex")).toBe(
      CUSTOM_PAYLOAD.toString("hex"),
    );
  });

  it("should successfully parse price feed updates with more than 3 price feed ids", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const sentValue = toNano("1");
    const result = await pythTest.sendParsePriceFeedUpdates(
      deployer.getSender(),
      Buffer.from(HERMES_SOL_TON_PYTH_USDT_UPDATE, "hex"),
      sentValue,
      [
        SOL_PRICE_FEED_ID,
        TON_PRICE_FEED_ID,
        PYTH_PRICE_FEED_ID,
        USDT_PRICE_FEED_ID,
      ],
      HERMES_SOL_UNIQUE_PUBLISH_TIME,
      HERMES_SOL_UNIQUE_PUBLISH_TIME,
      deployer.address,
      CUSTOM_PAYLOAD,
    );

    // Verify transaction success and message count
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
      outMessagesCount: 1,
    });

    // Get the output message
    const outMessage = result.transactions[1].outMessages.values()[0];

    // Verify excess value is returned
    expect(
      (outMessage.info as CommonMessageInfoInternal).value.coins,
    ).toBeGreaterThan(0);

    const cs = outMessage.body.beginParse();

    // Verify message header
    const op = cs.loadUint(32);
    expect(op).toBe(5); // OP_PARSE_PRICE_FEED_UPDATES

    // Verify number of price feeds
    const numPriceFeeds = cs.loadUint(8);
    expect(numPriceFeeds).toBe(4); // We expect SOL, TON, PYTH and USDT price feeds

    // Load and verify price feeds
    const priceFeedsCell = cs.loadRef();
    let currentCell = priceFeedsCell;

    // First price feed (SOL)
    const solCs = currentCell.beginParse();
    const solPriceId =
      "0x" + solCs.loadUintBig(256).toString(16).padStart(64, "0");
    expect(solPriceId).toBe(SOL_PRICE_FEED_ID);

    const solPriceFeedCell = solCs.loadRef();
    const solPriceFeedSlice = solPriceFeedCell.beginParse();

    // Verify SOL current price
    const solCurrentPriceCell = solPriceFeedSlice.loadRef();
    const solCurrentPrice = solCurrentPriceCell.beginParse();
    expect(solCurrentPrice.loadInt(64)).toBe(HERMES_SOL_UNIQUE_PRICE);
    expect(solCurrentPrice.loadUint(64)).toBe(HERMES_SOL_UNIQUE_CONF);
    expect(solCurrentPrice.loadInt(32)).toBe(HERMES_SOL_UNIQUE_EXPO);
    expect(solCurrentPrice.loadUint(64)).toBe(HERMES_SOL_UNIQUE_PUBLISH_TIME);

    // Move through TON and PYTH price feeds to reach USDT
    currentCell = solCs.loadRef(); // Move to TON
    const tonCs = currentCell.beginParse();
    tonCs.loadUintBig(256); // Skip TON price ID
    tonCs.loadRef(); // Skip TON price data

    currentCell = tonCs.loadRef(); // Move to PYTH
    const pythCs = currentCell.beginParse();
    pythCs.loadUintBig(256); // Skip PYTH price ID
    pythCs.loadRef(); // Skip PYTH price data

    currentCell = pythCs.loadRef(); // Move to USDT
    const usdtCs = currentCell.beginParse();
    const usdtPriceId =
      "0x" + usdtCs.loadUintBig(256).toString(16).padStart(64, "0");
    expect(usdtPriceId).toBe(USDT_PRICE_FEED_ID);

    const usdtPriceFeedCell = usdtCs.loadRef();
    const usdtPriceFeedSlice = usdtPriceFeedCell.beginParse();

    // Verify USDT current price
    const usdtCurrentPriceCell = usdtPriceFeedSlice.loadRef();
    const usdtCurrentPrice = usdtCurrentPriceCell.beginParse();
    expect(usdtCurrentPrice.loadInt(64)).toBe(HERMES_USDT_UNIQUE_PRICE);
    expect(usdtCurrentPrice.loadUint(64)).toBe(HERMES_USDT_UNIQUE_CONF);
    expect(usdtCurrentPrice.loadInt(32)).toBe(HERMES_USDT_UNIQUE_EXPO);
    expect(usdtCurrentPrice.loadUint(64)).toBe(HERMES_USDT_UNIQUE_PUBLISH_TIME);

    // Verify this is the end of the chain
    expect(usdtCs.remainingRefs).toBe(0);

    // Verify sender address
    const senderAddress = cs.loadAddress();
    expect(senderAddress?.toString()).toBe(
      deployer.getSender().address.toString(),
    );

    // Verify custom payload
    const customPayloadCell = cs.loadRef();
    const customPayloadSlice = customPayloadCell.beginParse();
    const receivedPayload = Buffer.from(
      customPayloadSlice.loadBuffer(CUSTOM_PAYLOAD.length),
    );
    expect(receivedPayload.toString("hex")).toBe(
      CUSTOM_PAYLOAD.toString("hex"),
    );
  });

  it("should successfully parse unique price feed updates", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const sentValue = toNano("1");
    const result = await pythTest.sendParseUniquePriceFeedUpdates(
      deployer.getSender(),
      Buffer.from(HERMES_BTC_ETH_UNIQUE_UPDATE, "hex"),
      sentValue,
      [BTC_PRICE_FEED_ID, ETH_PRICE_FEED_ID],
      HERMES_BTC_PUBLISH_TIME,
      60,
      deployer.address,
      CUSTOM_PAYLOAD,
    );

    // Verify transaction success and message count
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
      outMessagesCount: 1,
    });

    // Get the output message
    const outMessage = result.transactions[1].outMessages.values()[0];

    // Verify excess value is returned
    expect(
      (outMessage.info as CommonMessageInfoInternal).value.coins,
    ).toBeGreaterThan(0);

    const cs = outMessage.body.beginParse();

    // Verify message header
    const op = cs.loadUint(32);
    expect(op).toBe(6); // OP_PARSE_UNIQUE_PRICE_FEED_UPDATES

    // Verify number of price feeds
    const numPriceFeeds = cs.loadUint(8);
    expect(numPriceFeeds).toBe(2); // We expect BTC and ETH price feeds

    // Load and verify price feeds
    const priceFeedsCell = cs.loadRef();
    let currentCell = priceFeedsCell;

    // First price feed (BTC)
    const btcCs = currentCell.beginParse();
    const btcPriceId =
      "0x" + btcCs.loadUintBig(256).toString(16).padStart(64, "0");
    expect(btcPriceId).toBe(BTC_PRICE_FEED_ID);

    const btcPriceFeedCell = btcCs.loadRef();
    const btcPriceFeedSlice = btcPriceFeedCell.beginParse();

    // Verify BTC current price
    const btcCurrentPriceCell = btcPriceFeedSlice.loadRef();
    const btcCurrentPrice = btcCurrentPriceCell.beginParse();
    expect(btcCurrentPrice.loadInt(64)).toBe(HERMES_BTC_UNIQUE_PRICE);
    expect(btcCurrentPrice.loadUint(64)).toBe(HERMES_BTC_UNIQUE_CONF);
    expect(btcCurrentPrice.loadInt(32)).toBe(HERMES_BTC_UNIQUE_EXPO);
    expect(btcCurrentPrice.loadUint(64)).toBe(HERMES_BTC_UNIQUE_PUBLISH_TIME);

    // Verify BTC EMA price
    const btcEmaPriceCell = btcPriceFeedSlice.loadRef();
    const btcEmaPrice = btcEmaPriceCell.beginParse();
    expect(btcEmaPrice.loadInt(64)).toBe(HERMES_BTC_UNIQUE_EMA_PRICE);
    expect(btcEmaPrice.loadUint(64)).toBe(HERMES_BTC_UNIQUE_EMA_CONF);
    expect(btcEmaPrice.loadInt(32)).toBe(HERMES_BTC_UNIQUE_EMA_EXPO);
    expect(btcEmaPrice.loadUint(64)).toBe(HERMES_BTC_UNIQUE_EMA_PUBLISH_TIME);

    // Move to ETH price feed
    currentCell = btcCs.loadRef();

    // Second price feed (ETH)
    const ethCs = currentCell.beginParse();
    const ethPriceId =
      "0x" + ethCs.loadUintBig(256).toString(16).padStart(64, "0");
    expect(ethPriceId).toBe(ETH_PRICE_FEED_ID);

    const ethPriceFeedCell = ethCs.loadRef();
    const ethPriceFeedSlice = ethPriceFeedCell.beginParse();

    // Verify ETH current price
    const ethCurrentPriceCell = ethPriceFeedSlice.loadRef();
    const ethCurrentPrice = ethCurrentPriceCell.beginParse();
    expect(ethCurrentPrice.loadInt(64)).toBe(HERMES_ETH_UNIQUE_PRICE);
    expect(ethCurrentPrice.loadUint(64)).toBe(HERMES_ETH_UNIQUE_CONF);
    expect(ethCurrentPrice.loadInt(32)).toBe(HERMES_ETH_UNIQUE_EXPO);
    expect(ethCurrentPrice.loadUint(64)).toBe(HERMES_ETH_UNIQUE_PUBLISH_TIME);

    // Verify ETH EMA price
    const ethEmaPriceCell = ethPriceFeedSlice.loadRef();
    const ethEmaPrice = ethEmaPriceCell.beginParse();
    expect(ethEmaPrice.loadInt(64)).toBe(HERMES_ETH_UNIQUE_EMA_PRICE);
    expect(ethEmaPrice.loadUint(64)).toBe(HERMES_ETH_UNIQUE_EMA_CONF);
    expect(ethEmaPrice.loadInt(32)).toBe(HERMES_ETH_UNIQUE_EMA_EXPO);
    expect(ethEmaPrice.loadUint(64)).toBe(HERMES_ETH_UNIQUE_EMA_PUBLISH_TIME);

    // Verify this is the end of the chain
    expect(ethCs.remainingRefs).toBe(0);

    // Verify sender address
    const senderAddress = cs.loadAddress();
    expect(senderAddress?.toString()).toBe(
      deployer.getSender().address.toString(),
    );

    // Verify custom payload
    const customPayloadCell = cs.loadRef();
    const customPayloadSlice = customPayloadCell.beginParse();
    const receivedPayload = Buffer.from(
      customPayloadSlice.loadBuffer(CUSTOM_PAYLOAD.length),
    );
    expect(receivedPayload.toString("hex")).toBe(
      CUSTOM_PAYLOAD.toString("hex"),
    );
  });

  it("should successfully parse unique price feed updates with more than 3 price feed ids", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const sentValue = toNano("1");
    const result = await pythTest.sendParseUniquePriceFeedUpdates(
      deployer.getSender(),
      Buffer.from(HERMES_SOL_TON_PYTH_USDT_UPDATE, "hex"),
      sentValue,
      [
        SOL_PRICE_FEED_ID,
        TON_PRICE_FEED_ID,
        PYTH_PRICE_FEED_ID,
        USDT_PRICE_FEED_ID,
      ],
      HERMES_SOL_UNIQUE_PUBLISH_TIME,
      60,
      deployer.address,
      CUSTOM_PAYLOAD,
    );

    // Verify transaction success and message count
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
      outMessagesCount: 1,
    });

    // Get the output message
    const outMessage = result.transactions[1].outMessages.values()[0];

    // Verify excess value is returned
    expect(
      (outMessage.info as CommonMessageInfoInternal).value.coins,
    ).toBeGreaterThan(0);

    const cs = outMessage.body.beginParse();

    // Verify message header
    const op = cs.loadUint(32);
    expect(op).toBe(6); // OP_PARSE_UNIQUE_PRICE_FEED_UPDATES

    // Verify number of price feeds
    const numPriceFeeds = cs.loadUint(8);
    expect(numPriceFeeds).toBe(4); // We expect SOL, TON, PYTH and USDT price feeds

    // Load and verify price feeds
    const priceFeedsCell = cs.loadRef();
    let currentCell = priceFeedsCell;

    // First price feed (SOL)
    const solCs = currentCell.beginParse();
    const solPriceId =
      "0x" + solCs.loadUintBig(256).toString(16).padStart(64, "0");
    expect(solPriceId).toBe(SOL_PRICE_FEED_ID);

    const solPriceFeedCell = solCs.loadRef();
    const solPriceFeedSlice = solPriceFeedCell.beginParse();

    // Verify SOL current price
    const solCurrentPriceCell = solPriceFeedSlice.loadRef();
    const solCurrentPrice = solCurrentPriceCell.beginParse();
    expect(solCurrentPrice.loadInt(64)).toBe(HERMES_SOL_UNIQUE_PRICE);
    expect(solCurrentPrice.loadUint(64)).toBe(HERMES_SOL_UNIQUE_CONF);
    expect(solCurrentPrice.loadInt(32)).toBe(HERMES_SOL_UNIQUE_EXPO);
    expect(solCurrentPrice.loadUint(64)).toBe(HERMES_SOL_UNIQUE_PUBLISH_TIME);

    // Move through TON and PYTH price feeds to reach USDT
    currentCell = solCs.loadRef(); // Move to TON
    const tonCs = currentCell.beginParse();
    tonCs.loadUintBig(256); // Skip TON price ID
    tonCs.loadRef(); // Skip TON price data

    currentCell = tonCs.loadRef(); // Move to PYTH
    const pythCs = currentCell.beginParse();
    pythCs.loadUintBig(256); // Skip PYTH price ID
    pythCs.loadRef(); // Skip PYTH price data

    currentCell = pythCs.loadRef(); // Move to USDT
    const usdtCs = currentCell.beginParse();
    const usdtPriceId =
      "0x" + usdtCs.loadUintBig(256).toString(16).padStart(64, "0");
    expect(usdtPriceId).toBe(USDT_PRICE_FEED_ID);

    const usdtPriceFeedCell = usdtCs.loadRef();
    const usdtPriceFeedSlice = usdtPriceFeedCell.beginParse();

    // Verify USDT current price
    const usdtCurrentPriceCell = usdtPriceFeedSlice.loadRef();
    const usdtCurrentPrice = usdtCurrentPriceCell.beginParse();
    expect(usdtCurrentPrice.loadInt(64)).toBe(HERMES_USDT_UNIQUE_PRICE);
    expect(usdtCurrentPrice.loadUint(64)).toBe(HERMES_USDT_UNIQUE_CONF);
    expect(usdtCurrentPrice.loadInt(32)).toBe(HERMES_USDT_UNIQUE_EXPO);
    expect(usdtCurrentPrice.loadUint(64)).toBe(HERMES_USDT_UNIQUE_PUBLISH_TIME);

    // Verify this is the end of the chain
    expect(usdtCs.remainingRefs).toBe(0);

    // Verify sender address
    const senderAddress = cs.loadAddress();
    expect(senderAddress?.toString()).toBe(
      deployer.getSender().address.toString(),
    );

    // Verify custom payload
    const customPayloadCell = cs.loadRef();
    const customPayloadSlice = customPayloadCell.beginParse();
    const receivedPayload = Buffer.from(
      customPayloadSlice.loadBuffer(CUSTOM_PAYLOAD.length),
    );
    expect(receivedPayload.toString("hex")).toBe(
      CUSTOM_PAYLOAD.toString("hex"),
    );
  });

  it("should fail to parse invalid price feed updates", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const invalidUpdateData = Buffer.from("invalid data");

    const result = await pythTest.sendParsePriceFeedUpdates(
      deployer.getSender(),
      invalidUpdateData,
      toNano("1"),
      [BTC_PRICE_FEED_ID, ETH_PRICE_FEED_ID],
      HERMES_BTC_PUBLISH_TIME,
      HERMES_BTC_PUBLISH_TIME,
      deployer.address,
      CUSTOM_PAYLOAD,
    );

    // Verify transaction success but error response sent
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    // Find the error response message - it's in the second transaction's outMessages
    const errorTx = result.transactions[1]; // The PythTest contract transaction
    expect(errorTx.outMessages.values().length).toBeGreaterThan(0);

    const errorMessage = errorTx.outMessages.values()[0];
    expect(errorMessage).toBeDefined();

    const cs = errorMessage.body.beginParse();

    // Verify error response format
    const op = cs.loadUint(32);
    expect(op).toBe(0x10002); // OP_RESPONSE_ERROR

    const errorCode = cs.loadUint(32);
    expect(errorCode).toBe(2002); // ERROR_INVALID_MAGIC

    const originalOp = cs.loadUint(32);
    expect(originalOp).toBe(5); // OP_PARSE_PRICE_FEED_UPDATES

    // Verify custom payload is preserved
    const customPayloadCell = cs.loadRef();
    const customPayloadSlice = customPayloadCell.beginParse();
    expect(
      Buffer.from(
        customPayloadSlice.loadBuffer(CUSTOM_PAYLOAD.length),
      ).toString("hex"),
    ).toBe(CUSTOM_PAYLOAD.toString("hex"));
  });

  it("should fail to parse price feed updates within range", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const sentValue = toNano("1");
    const result = await pythTest.sendParseUniquePriceFeedUpdates(
      deployer.getSender(),
      Buffer.from(HERMES_BTC_ETH_UPDATE, "hex"),
      sentValue,
      [BTC_PRICE_FEED_ID, ETH_PRICE_FEED_ID],
      HERMES_BTC_PUBLISH_TIME + 1,
      HERMES_BTC_PUBLISH_TIME + 1,
      deployer.address,
      CUSTOM_PAYLOAD,
    );

    // Verify transaction success but error response sent
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    // Find the error response message - it's in the second transaction's outMessages
    const errorTx = result.transactions[1]; // The PythTest contract transaction
    expect(errorTx.outMessages.values().length).toBeGreaterThan(0);

    const errorMessage = errorTx.outMessages.values()[0];
    expect(errorMessage).toBeDefined();

    const cs = errorMessage.body.beginParse();

    // Verify error response format
    const op = cs.loadUint(32);
    expect(op).toBe(0x10002); // OP_RESPONSE_ERROR

    const errorCode = cs.loadUint(32);
    expect(errorCode).toBe(2020); // ERROR_PRICE_FEED_NOT_FOUND_WITHIN_RANGE

    const originalOp = cs.loadUint(32);
    expect(originalOp).toBe(6); // OP_PARSE_UNIQUE_PRICE_FEED_UPDATES

    // Verify custom payload is preserved
    const customPayloadCell = cs.loadRef();
    const customPayloadSlice = customPayloadCell.beginParse();
    expect(
      Buffer.from(
        customPayloadSlice.loadBuffer(CUSTOM_PAYLOAD.length),
      ).toString("hex"),
    ).toBe(CUSTOM_PAYLOAD.toString("hex"));
  });

  it("should fail to parse unique price feed updates", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const sentValue = toNano("1");
    const result = await pythTest.sendParseUniquePriceFeedUpdates(
      deployer.getSender(),
      Buffer.from(HERMES_BTC_ETH_UPDATE, "hex"),
      sentValue,
      [BTC_PRICE_FEED_ID, ETH_PRICE_FEED_ID],
      HERMES_BTC_PUBLISH_TIME,
      60,
      deployer.address,
      CUSTOM_PAYLOAD,
    );

    // Verify transaction success but error response sent
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    // Find the error response message - it's in the second transaction's outMessages
    const errorTx = result.transactions[1]; // The PythTest contract transaction
    expect(errorTx.outMessages.values().length).toBeGreaterThan(0);

    const errorMessage = errorTx.outMessages.values()[0];
    expect(errorMessage).toBeDefined();

    const cs = errorMessage.body.beginParse();

    // Verify error response format
    const op = cs.loadUint(32);
    expect(op).toBe(0x10002); // OP_RESPONSE_ERROR

    const errorCode = cs.loadUint(32);
    expect(errorCode).toBe(2020); // ERROR_PRICE_FEED_NOT_FOUND_WITHIN_RANGE

    const originalOp = cs.loadUint(32);
    expect(originalOp).toBe(6); // OP_PARSE_UNIQUE_PRICE_FEED_UPDATES

    // Verify custom payload is preserved
    const customPayloadCell = cs.loadRef();
    const customPayloadSlice = customPayloadCell.beginParse();
    expect(
      Buffer.from(
        customPayloadSlice.loadBuffer(CUSTOM_PAYLOAD.length),
      ).toString("hex"),
    ).toBe(CUSTOM_PAYLOAD.toString("hex"));
  });

  it("should successfully parse price feed updates in price ids order", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const sentValue = toNano("1");
    const result = await pythTest.sendParsePriceFeedUpdates(
      deployer.getSender(),
      Buffer.from(HERMES_BTC_ETH_UPDATE, "hex"),
      sentValue,
      [ETH_PRICE_FEED_ID, BTC_PRICE_FEED_ID],
      HERMES_BTC_PUBLISH_TIME,
      HERMES_BTC_PUBLISH_TIME,
      deployer.address,
      CUSTOM_PAYLOAD,
    );

    // Verify transaction success and message count
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
      outMessagesCount: 1,
    });

    // Get the output message
    const outMessage = result.transactions[1].outMessages.values()[0];

    // Verify excess value is returned
    expect(
      (outMessage.info as CommonMessageInfoInternal).value.coins,
    ).toBeGreaterThan(0);

    expect((outMessage.info as CommonMessageInfoInternal).dest.toString()).toBe(
      deployer.address.toString(),
    );

    const cs = outMessage.body.beginParse();

    // Verify message header
    const op = cs.loadUint(32);
    expect(op).toBe(5); // OP_PARSE_PRICE_FEED_UPDATES

    // Verify number of price feeds
    const numPriceFeeds = cs.loadUint(8);
    expect(numPriceFeeds).toBe(2); // We expect BTC and ETH price feeds

    // Load and verify price feeds
    const priceFeedsCell = cs.loadRef();
    let currentCell = priceFeedsCell;

    // First price feed (ETH)
    const ethCs = currentCell.beginParse();
    const ethPriceId =
      "0x" + ethCs.loadUintBig(256).toString(16).padStart(64, "0");
    expect(ethPriceId).toBe(ETH_PRICE_FEED_ID);

    const ethPriceFeedCell = ethCs.loadRef();
    const ethPriceFeedSlice = ethPriceFeedCell.beginParse();

    // Verify ETH current price
    const ethCurrentPriceCell = ethPriceFeedSlice.loadRef();
    const ethCurrentPrice = ethCurrentPriceCell.beginParse();
    expect(ethCurrentPrice.loadInt(64)).toBe(HERMES_ETH_PRICE);
    expect(ethCurrentPrice.loadUint(64)).toBe(HERMES_ETH_CONF);
    expect(ethCurrentPrice.loadInt(32)).toBe(HERMES_ETH_EXPO);
    expect(ethCurrentPrice.loadUint(64)).toBe(HERMES_ETH_PUBLISH_TIME);

    // Verify ETH EMA price
    const ethEmaPriceCell = ethPriceFeedSlice.loadRef();
    const ethEmaPrice = ethEmaPriceCell.beginParse();
    expect(ethEmaPrice.loadInt(64)).toBe(HERMES_ETH_EMA_PRICE);
    expect(ethEmaPrice.loadUint(64)).toBe(HERMES_ETH_EMA_CONF);
    expect(ethEmaPrice.loadInt(32)).toBe(HERMES_ETH_EMA_EXPO);
    expect(ethEmaPrice.loadUint(64)).toBe(HERMES_ETH_PUBLISH_TIME);

    // Move to ETH price feed
    currentCell = ethCs.loadRef();

    // Second price feed (BTC)
    const btcCs = currentCell.beginParse();
    const btcPriceId =
      "0x" + btcCs.loadUintBig(256).toString(16).padStart(64, "0");
    expect(btcPriceId).toBe(BTC_PRICE_FEED_ID);

    const btcPriceFeedCell = btcCs.loadRef();
    const btcPriceFeedSlice = btcPriceFeedCell.beginParse();

    // Verify BTC current price
    const btcCurrentPriceCell = btcPriceFeedSlice.loadRef();
    const btcCurrentPrice = btcCurrentPriceCell.beginParse();
    expect(btcCurrentPrice.loadInt(64)).toBe(HERMES_BTC_PRICE);
    expect(btcCurrentPrice.loadUint(64)).toBe(HERMES_BTC_CONF);
    expect(btcCurrentPrice.loadInt(32)).toBe(HERMES_BTC_EXPO);
    expect(btcCurrentPrice.loadUint(64)).toBe(HERMES_BTC_PUBLISH_TIME);

    // Verify BTC EMA price
    const btcEmaPriceCell = btcPriceFeedSlice.loadRef();
    const btcEmaPrice = btcEmaPriceCell.beginParse();
    expect(btcEmaPrice.loadInt(64)).toBe(HERMES_BTC_EMA_PRICE);
    expect(btcEmaPrice.loadUint(64)).toBe(HERMES_BTC_EMA_CONF);
    expect(btcEmaPrice.loadInt(32)).toBe(HERMES_BTC_EMA_EXPO);
    expect(btcEmaPrice.loadUint(64)).toBe(HERMES_BTC_PUBLISH_TIME);

    // Verify this is the end of the chain
    expect(ethCs.remainingRefs).toBe(0);
  });

  it("should successfully parse unique price feed updates in price ids order", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const sentValue = toNano("1");
    const result = await pythTest.sendParseUniquePriceFeedUpdates(
      deployer.getSender(),
      Buffer.from(HERMES_BTC_ETH_UNIQUE_UPDATE, "hex"),
      sentValue,
      [ETH_PRICE_FEED_ID, BTC_PRICE_FEED_ID],
      HERMES_BTC_PUBLISH_TIME,
      60,
      deployer.address,
      CUSTOM_PAYLOAD,
    );

    // Verify transaction success and message count
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
      outMessagesCount: 1,
    });

    // Get the output message
    const outMessage = result.transactions[1].outMessages.values()[0];

    // Verify excess value is returned
    expect(
      (outMessage.info as CommonMessageInfoInternal).value.coins,
    ).toBeGreaterThan(0);

    const cs = outMessage.body.beginParse();

    // Verify message header
    const op = cs.loadUint(32);
    expect(op).toBe(6); // OP_PARSE_UNIQUE_PRICE_FEED_UPDATES

    // Verify number of price feeds
    const numPriceFeeds = cs.loadUint(8);
    expect(numPriceFeeds).toBe(2); // We expect BTC and ETH price feeds

    // Load and verify price feeds
    const priceFeedsCell = cs.loadRef();
    let currentCell = priceFeedsCell;

    // First price feed (ETH)
    const ethCs = currentCell.beginParse();
    const ethPriceId =
      "0x" + ethCs.loadUintBig(256).toString(16).padStart(64, "0");
    expect(ethPriceId).toBe(ETH_PRICE_FEED_ID);

    const ethPriceFeedCell = ethCs.loadRef();
    const ethPriceFeedSlice = ethPriceFeedCell.beginParse();

    // Verify ETH current price
    const ethCurrentPriceCell = ethPriceFeedSlice.loadRef();
    const ethCurrentPrice = ethCurrentPriceCell.beginParse();
    expect(ethCurrentPrice.loadInt(64)).toBe(HERMES_ETH_UNIQUE_PRICE);
    expect(ethCurrentPrice.loadUint(64)).toBe(HERMES_ETH_UNIQUE_CONF);
    expect(ethCurrentPrice.loadInt(32)).toBe(HERMES_ETH_UNIQUE_EXPO);
    expect(ethCurrentPrice.loadUint(64)).toBe(HERMES_ETH_UNIQUE_PUBLISH_TIME);

    // Verify ETH EMA price
    const ethEmaPriceCell = ethPriceFeedSlice.loadRef();
    const ethEmaPrice = ethEmaPriceCell.beginParse();
    expect(ethEmaPrice.loadInt(64)).toBe(HERMES_ETH_UNIQUE_EMA_PRICE);
    expect(ethEmaPrice.loadUint(64)).toBe(HERMES_ETH_UNIQUE_EMA_CONF);
    expect(ethEmaPrice.loadInt(32)).toBe(HERMES_ETH_UNIQUE_EMA_EXPO);
    expect(ethEmaPrice.loadUint(64)).toBe(HERMES_ETH_UNIQUE_EMA_PUBLISH_TIME);

    currentCell = ethCs.loadRef();

    // Second price feed (BTC)
    const btcCs = currentCell.beginParse();
    const btcPriceId =
      "0x" + btcCs.loadUintBig(256).toString(16).padStart(64, "0");
    expect(btcPriceId).toBe(BTC_PRICE_FEED_ID);

    const btcPriceFeedCell = btcCs.loadRef();
    const btcPriceFeedSlice = btcPriceFeedCell.beginParse();

    // Verify BTC current price
    const btcCurrentPriceCell = btcPriceFeedSlice.loadRef();
    const btcCurrentPrice = btcCurrentPriceCell.beginParse();
    expect(btcCurrentPrice.loadInt(64)).toBe(HERMES_BTC_UNIQUE_PRICE);
    expect(btcCurrentPrice.loadUint(64)).toBe(HERMES_BTC_UNIQUE_CONF);
    expect(btcCurrentPrice.loadInt(32)).toBe(HERMES_BTC_UNIQUE_EXPO);
    expect(btcCurrentPrice.loadUint(64)).toBe(HERMES_BTC_UNIQUE_PUBLISH_TIME);

    // Verify BTC EMA price
    const btcEmaPriceCell = btcPriceFeedSlice.loadRef();
    const btcEmaPrice = btcEmaPriceCell.beginParse();
    expect(btcEmaPrice.loadInt(64)).toBe(HERMES_BTC_UNIQUE_EMA_PRICE);
    expect(btcEmaPrice.loadUint(64)).toBe(HERMES_BTC_UNIQUE_EMA_CONF);
    expect(btcEmaPrice.loadInt(32)).toBe(HERMES_BTC_UNIQUE_EMA_EXPO);
    expect(btcEmaPrice.loadUint(64)).toBe(HERMES_BTC_UNIQUE_EMA_PUBLISH_TIME);

    // Verify this is the end of the chain
    expect(btcCs.remainingRefs).toBe(0);
  });

  it("should successfully parse price feed updates with a different target address", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const sentValue = toNano("1");
    const result = await pythTest.sendParsePriceFeedUpdates(
      deployer.getSender(),
      Buffer.from(HERMES_BTC_ETH_UPDATE, "hex"),
      sentValue,
      [BTC_PRICE_FEED_ID, ETH_PRICE_FEED_ID],
      HERMES_BTC_PUBLISH_TIME,
      HERMES_BTC_PUBLISH_TIME,
      mockDeployer.address,
      CUSTOM_PAYLOAD,
    );

    // Verify transaction success and message count
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
      outMessagesCount: 1,
    });

    // Verify message success to target address
    expect(result.transactions).toHaveTransaction({
      from: pythTest.address,
      to: mockDeployer.address,
      success: true,
    });

    // Get the output message
    const outMessage = result.transactions[1].outMessages.values()[0];

    // Verify excess value is returned
    expect(
      (outMessage.info as CommonMessageInfoInternal).value.coins,
    ).toBeGreaterThan(0);

    const cs = outMessage.body.beginParse();

    // Verify message header
    const op = cs.loadUint(32);
    expect(op).toBe(5); // OP_PARSE_PRICE_FEED_UPDATES

    // Verify number of price feeds
    const numPriceFeeds = cs.loadUint(8);
    expect(numPriceFeeds).toBe(2); // We expect BTC and ETH price feeds

    cs.loadRef(); // Skip price feeds

    // Verify sender address
    const senderAddress = cs.loadAddress();
    expect(senderAddress?.toString()).toBe(
      deployer.getSender().address.toString(),
    );

    // Verify custom payload
    const customPayloadCell = cs.loadRef();
    const customPayloadSlice = customPayloadCell.beginParse();
    const receivedPayload = Buffer.from(
      customPayloadSlice.loadBuffer(CUSTOM_PAYLOAD.length),
    );
    expect(receivedPayload.toString("hex")).toBe(
      CUSTOM_PAYLOAD.toString("hex"),
    );
  });

  it("should successfully parse unique price feed updates with a different target address", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const sentValue = toNano("1");
    const result = await pythTest.sendParseUniquePriceFeedUpdates(
      deployer.getSender(),
      Buffer.from(HERMES_BTC_ETH_UNIQUE_UPDATE, "hex"),
      sentValue,
      [BTC_PRICE_FEED_ID, ETH_PRICE_FEED_ID],
      HERMES_BTC_PUBLISH_TIME,
      60,
      mockDeployer.address,
      CUSTOM_PAYLOAD,
    );

    // Verify transaction success and message count
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
      outMessagesCount: 1,
    });

    // Verify message success to target address
    expect(result.transactions).toHaveTransaction({
      from: pythTest.address,
      to: mockDeployer.address,
      success: true,
    });

    // Get the output message
    const outMessage = result.transactions[1].outMessages.values()[0];

    // Verify excess value is returned
    expect(
      (outMessage.info as CommonMessageInfoInternal).value.coins,
    ).toBeGreaterThan(0);

    const cs = outMessage.body.beginParse();

    // Verify message header
    const op = cs.loadUint(32);
    expect(op).toBe(6); // OP_PARSE_UNIQUE_PRICE_FEED_UPDATES

    // Verify number of price feeds
    const numPriceFeeds = cs.loadUint(8);
    expect(numPriceFeeds).toBe(2); // We expect BTC and ETH price feeds

    cs.loadRef(); // Skip price feeds

    // Verify sender address
    const senderAddress = cs.loadAddress();
    expect(senderAddress?.toString()).toBe(
      deployer.getSender().address.toString(),
    );

    // Verify custom payload
    const customPayloadCell = cs.loadRef();
    const customPayloadSlice = customPayloadCell.beginParse();
    const receivedPayload = Buffer.from(
      customPayloadSlice.loadBuffer(CUSTOM_PAYLOAD.length),
    );
    expect(receivedPayload.toString("hex")).toBe(
      CUSTOM_PAYLOAD.toString("hex"),
    );
  });
});
