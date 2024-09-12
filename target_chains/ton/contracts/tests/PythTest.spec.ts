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
} from "./utils/pyth";
import { GUARDIAN_SET_0, MAINNET_UPGRADE_VAAS } from "./utils/wormhole";
import { DataSource } from "@pythnetwork/xc-admin-common";
import { parseDataSource } from "./utils";

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
    governanceContract: string = "0000000000000000000000000000000000000000000000000000000000000004",
    governanceDataSource?: DataSource
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

    await updateGuardianSets(pythTest, deployer);

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

  it("should fail to get update fee with invalid data", async () => {
    await deployContract();
    await updateGuardianSets(pythTest, deployer);

    const invalidUpdateData = Buffer.from("invalid data");

    await expect(pythTest.getUpdateFee(invalidUpdateData)).rejects.toThrow(
      "Unable to execute get method. Got exit_code: 1021"
    ); // ERROR_INVALID_MAGIC = 1021
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
      exitCode: 1021, // ERROR_INVALID_MAGIC
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
      TIME_PERIOD,
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
      exitCode: 1024, // ERROR_UPDATE_DATA_SOURCE_NOT_FOUND
    });
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
      exitCode: 1037, // ERROR_INSUFFICIENT_GAS
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
      156000000n + BigInt(insufficientFee) // 156000000 = 390000 (estimated gas used for the transaction, this is defined in contracts/common/gas.fc as UPDATE_PRICE_FEEDS_GAS) * 400 (current settings in basechain are as follows: 1 unit of gas costs 400 nanotons)
    );

    // Check that the transaction did not succeed
    expect(result.transactions).toHaveTransaction({
      from: deployer.address,
      to: pythTest.address,
      success: false,
      exitCode: 1030, // ERROR_INSUFFICIENT_FEE = 1030
    });
  });

  it("should fail to get price for non-existent price feed", async () => {
    await deployContract();

    const nonExistentPriceFeedId =
      "0000000000000000000000000000000000000000000000000000000000000000";

    await expect(
      pythTest.getPriceUnsafe(nonExistentPriceFeedId)
    ).rejects.toThrow("Unable to execute get method. Got exit_code: 1019"); // ERROR_PRICE_FEED_NOT_FOUND = 1019
  });

  it("should correctly get chain ID", async () => {
    await deployContract();

    const result = await pythTest.getChainId();
    expect(result).toEqual(1);
  });

  it("should correctly get last executed governance sequence", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      TIME_PERIOD,
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
      TIME_PERIOD,
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
    expect(result).toBeDefined();
    expect(result.bits.length).toBe(0);
    expect(result.refs.length).toBe(0);

    // Deploy contract with initial governance data source
    await deployContract(
      BTC_PRICE_FEED_ID,
      TIME_PERIOD,
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
    let dataSource = parseDataSource(result);
    expect(dataSource).toEqual(TEST_GOVERNANCE_DATA_SOURCES[0]);

    // Execute governance action to change data source
    await pythTest.sendExecuteGovernanceAction(
      deployer.getSender(),
      Buffer.from(PYTH_AUTHORIZE_GOVERNANCE_DATA_SOURCE_TRANSFER, "hex")
    );

    // Check that the data source has changed
    result = await pythTest.getGovernanceDataSource();
    dataSource = parseDataSource(result);
    expect(dataSource).toEqual(TEST_GOVERNANCE_DATA_SOURCES[1]);
  });

  it("should correctly get single update fee", async () => {
    await deployContract();

    // Get the initial fee
    const result = await pythTest.getSingleUpdateFee();

    expect(result).toBe(SINGLE_UPDATE_FEE);
  });

  it("should execute set fee governance instruction", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      TIME_PERIOD,
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

  it("should execute authorize governance data source transfer", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      TIME_PERIOD,
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
    const initialDataSourceCell = await pythTest.getGovernanceDataSource();
    const initialDataSource = parseDataSource(initialDataSourceCell);
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
    const newDataSourceCell = await pythTest.getGovernanceDataSource();
    const newDataSource = parseDataSource(newDataSourceCell);
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
      TIME_PERIOD,
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
      exitCode: 1012, // ERROR_INVALID_GOVERNANCE_ACTION = 1012
    });

    // Verify that the governance data source index hasn't changed
    const index = await pythTest.getGovernanceDataSourceIndex();
    expect(index).toEqual(0); // Should still be the initial value

    // Verify that the governance data source hasn't changed
    const dataSourceCell = await pythTest.getGovernanceDataSource();
    const dataSource = parseDataSource(dataSourceCell);
    expect(dataSource).toEqual(TEST_GOVERNANCE_DATA_SOURCES[1]); // Should still be the initial value
  });

  it("should fail to execute governance action with invalid governance data source", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      TIME_PERIOD,
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
      exitCode: 1032, // ERROR_INVALID_GOVERNANCE_DATA_SOURCE
    });
  });

  it("should fail to execute governance action with old sequence number", async () => {
    await deployContract(
      BTC_PRICE_FEED_ID,
      TIME_PERIOD,
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
      exitCode: 1033, // ERROR_OLD_GOVERNANCE_MESSAGE
    });
  });
});
