import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { Cell, toNano } from "@ton/core";
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
import { BASE_UPDATE_PRICE_FEEDS_FEE } from "@pythnetwork/pyth-ton-js";

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
    price: Price = PRICE,
    emaPrice: Price = EMA_PRICE,
    singleUpdateFee: number = SINGLE_UPDATE_FEE,
    dataSources: DataSource[] = DATA_SOURCES,
    guardianSetIndex: number = 0,
    guardianSet: string[] = GUARDIAN_SET_0,
    chainId: number = 1,
    governanceChainId: number = 1,
    governanceContract: string = "0000000000000000000000000000000000000000000000000000000000000004",
    governanceDataSource?: DataSource
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
      toNano("0.05")
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
    deployer: SandboxContract<TreasuryContract>
  ) {
    for (const vaa of MAINNET_UPGRADE_VAAS) {
      const result = await pythTest.sendUpdateGuardianSet(
        deployer.getSender(),
        Buffer.from(vaa, "hex")
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
      Buffer.from(HERMES_BTC_ETH_UPDATE, "hex")
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
      "Unable to execute get method. Got exit_code: 2000"
    ); // ERROR_PRICE_FEED_NOT_FOUND = 2000

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
      "Unable to execute get method. Got exit_code: 2002"
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
      updateFee
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
      toNano(updateFee)
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
      [] // Empty data sources
    );
    await updateGuardianSets(pythTest, deployer);

    const updateData = Buffer.from(HERMES_BTC_ETH_UPDATE, "hex");
    const updateFee = await pythTest.getUpdateFee(updateData);

    const result = await pythTest.sendUpdatePriceFeeds(
      deployer.getSender(),
      updateData,
      toNano(updateFee)
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
      pythTest.getPriceNoOlderThan(TIME_PERIOD, BTC_PRICE_FEED_ID)
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 2001"); // ERROR_OUTDATED_PRICE = 2001
  });

  it("should fail to update price feeds with insufficient gas", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const updateData = Buffer.from(HERMES_BTC_ETH_UPDATE, "hex");

    const result = await pythTest.sendUpdatePriceFeeds(
      deployer.getSender(),
      updateData,
      toNano("0.1") // Insufficient gas
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
      BASE_UPDATE_PRICE_FEEDS_FEE + BigInt(insufficientFee)
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
      pythTest.getPriceUnsafe(nonExistentPriceFeedId)
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 2000"); // ERROR_PRICE_FEED_NOT_FOUND = 2000

    await expect(
      pythTest.getPriceNoOlderThan(TIME_PERIOD, nonExistentPriceFeedId)
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 2000"); // ERROR_PRICE_FEED_NOT_FOUND

    await expect(
      pythTest.getEmaPriceUnsafe(nonExistentPriceFeedId)
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
      TEST_GOVERNANCE_DATA_SOURCES[0]
    );

    // Check initial value
    let result = await pythTest.getLastExecutedGovernanceSequence();
    expect(result).toEqual(0);

    // Execute a governance action (e.g., set fee)
    await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_FEE, "hex")
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
      TEST_GOVERNANCE_DATA_SOURCES[0]
    );

    // Check initial value
    let result = await pythTest.getGovernanceDataSourceIndex();
    expect(result).toEqual(0);

    // Execute governance action to change data source
    await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_AUTHORIZE_GOVERNANCE_DATA_SOURCE_TRANSFER, "hex")
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
      TEST_GOVERNANCE_DATA_SOURCES[0]
    );

    // Check that the governance data source is set
    result = await pythTest.getGovernanceDataSource();
    expect(result).toEqual(TEST_GOVERNANCE_DATA_SOURCES[0]);

    // Execute governance action to change data source
    await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_AUTHORIZE_GOVERNANCE_DATA_SOURCE_TRANSFER, "hex")
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
      TEST_GOVERNANCE_DATA_SOURCES[0]
    );

    // Execute the governance action
    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_DATA_SOURCES, "hex")
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
    const oldDataSourceIsValid = await pythTest.getIsValidDataSource(
      oldDataSource
    );
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
      TEST_GOVERNANCE_DATA_SOURCES[0]
    );

    // Get the initial fee
    const initialFee = await pythTest.getSingleUpdateFee();
    expect(initialFee).toBe(SINGLE_UPDATE_FEE);

    // Execute the governance action
    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_FEE, "hex")
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
      TEST_GOVERNANCE_DATA_SOURCES[0]
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
      Buffer.from(PYTH_AUTHORIZE_GOVERNANCE_DATA_SOURCE_TRANSFER, "hex")
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
      TEST_GOVERNANCE_DATA_SOURCES[1]
    );

    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_REQUEST_GOVERNANCE_DATA_SOURCE_TRANSFER, "hex")
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
      TEST_GOVERNANCE_DATA_SOURCES[1]
    );

    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_FEE, "hex")
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
      TEST_GOVERNANCE_DATA_SOURCES[0]
    );

    // Execute a governance action to increase the sequence number
    await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_FEE, "hex")
    );

    // Try to execute the same governance action again
    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_FEE, "hex")
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
      TEST_GOVERNANCE_DATA_SOURCES[0]
    );

    const result = await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_SET_FEE, "hex")
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
      TEST_GOVERNANCE_DATA_SOURCES[2]
    );

    // Execute the upgrade
    const sendExecuteGovernanceActionResult =
      await pythTest.sendExecuteGovernanceAction(
        deployer.getSender(),
        Buffer.from(serialize(authorizeUpgradeVaa))
      );

    expect(sendExecuteGovernanceActionResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: true,
    });

    // Execute the upgrade
    const sendUpgradeContractResult = await pythTest.sendUpgradeContract(
      deployer.getSender(),
      upgradedCode
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
      TEST_GOVERNANCE_DATA_SOURCES[2]
    );

    // Execute the upgrade authorization
    const sendExecuteGovernanceActionResult =
      await pythTest.sendExecuteGovernanceAction(
        deployer.getSender(),
        Buffer.from(serialize(authorizeUpgradeVaa))
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
      wormholeTestCode
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

  it("should correctly get data sources", async () => {
    await deployContract();

    const dataSources = await pythTest.getDataSources();
    expect(dataSources).toEqual(DATA_SOURCES);
  });
});
