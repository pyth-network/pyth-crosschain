const elliptic = require("elliptic");
const governance = require("@pythnetwork/xc-governance-sdk");


const { deployProxy, upgradeProxy } = require("@openzeppelin/truffle-upgrades");
const {
  expectRevert,
  expectEvent,
  time,
} = require("@openzeppelin/test-helpers");
const { assert, expect } = require("chai");

// Use "WormholeReceiver" if you are testing with Wormhole Receiver
const Wormhole = artifacts.require("Wormhole");

const PythUpgradable = artifacts.require("PythUpgradable");
const MockPythUpgrade = artifacts.require("MockPythUpgrade");
const MockUpgradeableProxy = artifacts.require("MockUpgradeableProxy");

const testSigner1PK =
  "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";
const testSigner2PK =
  "892330666a850761e7370376430bb8c2aa1494072d3bfeaed0c4fa3d5a9135fe";

contract("Pyth", function () {
  const testSigner1 = web3.eth.accounts.privateKeyToAccount(testSigner1PK);
  const testSigner2 = web3.eth.accounts.privateKeyToAccount(testSigner2PK);
  const testGovernanceChainId = "1";
  const testGovernanceEmitter =
    "0x0000000000000000000000000000000000000000000000000000000000001234";
  const testPyth2WormholeChainId = "1";
  const testPyth2WormholeEmitter =
    "0x71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b";

  // Place all atomic operations that are done within migrations here.
  beforeEach(async function () {
    this.pythProxy = await deployProxy(PythUpgradable, [
      (await Wormhole.deployed()).address,
      [testPyth2WormholeChainId],
      [testPyth2WormholeEmitter],
      testGovernanceChainId,
      testGovernanceEmitter,
      0, // Initial governance sequence
      60, // Validity time in seconds
      0, // single update fee in wei
    ]);
  });

  it("should be initialized with the correct signers and values", async function () {
    await this.pythProxy.isValidDataSource(
      testPyth2WormholeChainId,
      testPyth2WormholeEmitter
    );
  });

  it("there should be no owner", async function () {
    // Check that the ownership is renounced.
    const owner = await this.pythProxy.owner();
    assert.equal(owner, "0x0000000000000000000000000000000000000000");
  });

  it("deployer cannot upgrade the contract", async function () {
    // upgrade proxy should fail
    await expectRevert(
      upgradeProxy(this.pythProxy.address, MockPythUpgrade),
      "Ownable: caller is not the owner."
    );
  });

  // NOTE(2022-05-02): Raw hex payload obtained from format serialization unit tests in `wormhole_attester/sdk/rust`
  // Latest known addition: wire format v3
  //
  // Tests rely on a wormhole_attester/sdk/rust mock price/prod ID generation rule:
  // nthProdByte(n) = n % 256, starting with n=1
  // nthPriceByte(n) = 255 - (n % 256), starting with n=1
  //
  // Examples:
  // 1st prod = "0x010101[...]"
  // 1st price = "0xFEFEFE[...]"
  // 2nd prod = "0x020202[...]"
  // 2nd price = "0xFDFDFD[...]"
  // 3rd prod = "0x030303[...]"
  // 3rd price = "0xFCFCFC[...]"
  const RAW_BATCH_ATTESTATION_TIME_REGEX = /DEADBEEFFADEDEED/g;
  const RAW_BATCH_PUBLISH_TIME_REGEX = /00000000DADEBEEF/g;
  const RAW_BATCH_PRICE_REGEX = /0000002BAD2FEED7/g;
  const RAW_BATCH_PREV_PRICE_REGEX = /0000DEADFACEBEEF/g;
  const RAW_BATCH_PREV_PUBLISH_TIME_REGEX = /00000000DEADBABE/g;
  const RAW_BATCH_EMA_PRICE_REGEX = /FFFFFFFFFFFFFFD6/g;
  const RAW_PRICE_ATTESTATION_SIZE = 149;
  const RAW_BATCH_ATTESTATION_COUNT = 10;
  const RAW_BATCH =
    "0x" +
    "5032574800030000000102000A00950101010101010101010101010101010101010101010101010101010101010101FEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFE0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0202020202020202020202020202020202020202020202020202020202020202FDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFD0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0303030303030303030303030303030303030303030303030303030303030303FCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFC0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0404040404040404040404040404040404040404040404040404040404040404FBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFBFB0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0505050505050505050505050505050505050505050505050505050505050505FAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFAFA0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0606060606060606060606060606060606060606060606060606060606060606F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F9F90000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0707070707070707070707070707070707070707070707070707070707070707F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F8F80000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0808080808080808080808080808080808080808080808080808080808080808F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F7F70000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0909090909090909090909090909090909090909090909090909090909090909F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F6F60000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0A0AF5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F5F50000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF";
  const RAW_UNKNOWN_BATCH_ATTESTATION_COUNT = 3;
  const RAW_UNKNOWN_BATCH =
    "0x" +
    "5032574800030000000102000300950101010101010101010101010101010101010101010101010101010101010101FEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFE0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A000001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0202020202020202020202020202020202020202020202020202020202020202FDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFD0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A000001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF0303030303030303030303030303030303030303030303030303030303030303FCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFC0000002BAD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A000001E14C0004E6D0DEADBEEFFADEDEED00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEF";

  // Takes an unsigned 64-bit integer, converts it to hex with 0-padding
  function u64ToHex(timestamp) {
    // u64 -> 8 bytes -> 16 hex bytes
    return timestamp.toString(16).padStart(16, "0");
  }

  function generateRawBatchAttestation(
    publishTime,
    attestationTime,
    priceVal,
    emaPriceVal
  ) {
    const pubTs = u64ToHex(publishTime);
    const attTs = u64ToHex(attestationTime);
    const price = u64ToHex(priceVal);
    const emaPrice = u64ToHex(emaPriceVal || priceVal);
    const replaced = RAW_BATCH.replace(RAW_BATCH_PUBLISH_TIME_REGEX, pubTs)
      .replace(RAW_BATCH_ATTESTATION_TIME_REGEX, attTs)
      .replace(RAW_BATCH_PRICE_REGEX, price)
      .replace(RAW_BATCH_EMA_PRICE_REGEX, emaPrice);
    return replaced;
  }

  function generateRawUnknownBatchAttestation(
    publishTime,
    attestationTime,
    priceVal,
    emaPriceVal,
    prevPublishTime,
    prevPriceVal
  ) {
    const pubTs = u64ToHex(publishTime);
    const attTs = u64ToHex(attestationTime);
    const price = u64ToHex(priceVal);
    const emaPrice = u64ToHex(emaPriceVal);
    const prevPubTs = u64ToHex(prevPublishTime);
    const prevPrice = u64ToHex(prevPriceVal);

    const replaced = RAW_UNKNOWN_BATCH.replace(
      RAW_BATCH_PUBLISH_TIME_REGEX,
      pubTs
    )
      .replace(RAW_BATCH_ATTESTATION_TIME_REGEX, attTs)
      .replace(RAW_BATCH_PRICE_REGEX, price)
      .replace(RAW_BATCH_EMA_PRICE_REGEX, emaPrice)
      .replace(RAW_BATCH_PREV_PUBLISH_TIME_REGEX, prevPubTs)
      .replace(RAW_BATCH_PREV_PRICE_REGEX, prevPrice);
    return replaced;
  }

  it("should parse batch price attestation correctly", async function () {
    let attestationTime = 1647273460; // re-used for publishTime
    let publishTime = 1647273465; // re-used for publishTime
    let priceVal = 1337;
    let emaPriceVal = 2022;
    let rawBatch = generateRawBatchAttestation(
      publishTime,
      attestationTime,
      priceVal,
      emaPriceVal
    );

    const receipt = await updatePriceFeeds(this.pythProxy, [rawBatch]);

    expectEventMultipleTimes(
      receipt,
      "PriceFeedUpdate",
      {
        price: "1337",
      },
      10
    );

    for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
      const price_id =
        "0x" + (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);

      const price = await this.pythProxy.getPriceUnsafe(price_id);
      assert.equal(price.price, priceVal.toString());
      assert.equal(price.conf, "101"); // The value is hardcoded in the RAW_BATCH.
      assert.equal(price.publishTime, publishTime.toString());
      assert.equal(price.expo, "-3"); // The value is hardcoded in the RAW_BATCH.

      const emaPrice = await this.pythProxy.getEmaPriceUnsafe(price_id);
      assert.equal(emaPrice.price, emaPriceVal.toString());
      assert.equal(emaPrice.conf, "42"); // The value is hardcoded in the RAW_BATCH.
      assert.equal(emaPrice.publishTime, publishTime.toString());
      assert.equal(emaPrice.expo, "-3"); // The value is hardcoded in the RAW_BATCH.
    }
  });

  async function updatePriceFeeds(
    contract,
    batches,
    valueInWei,
    chainId,
    emitter
  ) {
    let updateData = [];
    for (let data of batches) {
      const vm = await signAndEncodeVM(
        1,
        1,
        chainId || testPyth2WormholeChainId,
        emitter || testPyth2WormholeEmitter,
        0,
        data,
        [testSigner1PK],
        0,
        0
      );
      updateData.push("0x" + vm);
    }
    return await contract.updatePriceFeeds(updateData, { value: valueInWei });
  }

  /**
   * Create a governance instruction VAA from the Instruction object. Then
   * Submit and execute it on the contract.
   * @param contract Pyth contract
   * @param {governance.Instruction} governanceInstruction
   * @param {number} sequence
   */
  async function createAndThenSubmitGovernanceInstructionVaa(
    contract,
    governanceInstruction,
    sequence
  ) {
    await contract.executeGovernanceInstruction(
      await createVAAFromUint8Array(
        governanceInstruction.serialize(),
        testGovernanceChainId,
        testGovernanceEmitter,
        sequence
      )
    );
  }

  it("should attest price updates over wormhole", async function () {
    let ts = 1647273460;
    let rawBatch = generateRawBatchAttestation(ts - 5, ts, 1337);
    await updatePriceFeeds(this.pythProxy, [rawBatch]);
  });

  it("should attest price updates empty", async function () {
    const receipt = await updatePriceFeeds(this.pythProxy, []);
    expectEvent.notEmitted(receipt, "PriceFeedUpdate");
    expectEvent.notEmitted(receipt, "BatchPriceFeedUpdate");
  });

  it("should attest price updates with multiple batches of correct order", async function () {
    let ts = 1647273460;
    let rawBatch1 = generateRawBatchAttestation(ts - 5, ts, 1337);
    let rawBatch2 = generateRawBatchAttestation(ts + 5, ts + 10, 1338);
    const receipt = await updatePriceFeeds(this.pythProxy, [
      rawBatch1,
      rawBatch2,
    ]);
    expectEvent(receipt, "PriceFeedUpdate", {
      publishTime: (ts - 5).toString(),
    });
    expectEvent(receipt, "PriceFeedUpdate", {
      publishTime: (ts + 5).toString(),
    });
    expectEventMultipleTimes(receipt, "BatchPriceFeedUpdate", {}, 2);
  });

  it("should attest price updates with multiple batches of wrong order", async function () {
    let ts = 1647273460;
    let rawBatch1 = generateRawBatchAttestation(ts - 5, ts, 1337);
    let rawBatch2 = generateRawBatchAttestation(ts + 5, ts + 10, 1338);
    const receipt = await updatePriceFeeds(this.pythProxy, [
      rawBatch2,
      rawBatch1,
    ]);
    expectEvent(receipt, "PriceFeedUpdate", {
      publishTime: (ts + 5).toString(),
    });
    expectEventMultipleTimes(receipt, "BatchPriceFeedUpdate", {}, 2);
    expectEventNotEmittedWithArgs(receipt, "PriceFeedUpdate", {
      publishTime: (ts - 5).toString(),
    });
  });

  /**
   * Set fee to `newFee` by creating and submitting a governance instruction for it.
   * @param contarct Pyth contract
   * @param {number} newFee
   * @param {number=} governanceSequence Sequence number of the governance instruction. Defaults to 1.
   */
  async function setFeeTo(contract, newFee, governanceSequence) {
    await createAndThenSubmitGovernanceInstructionVaa(
      contract,
      new governance.SetFeeInstruction(
        governance.CHAINS.ethereum,
        BigInt(newFee),
        BigInt(0)
      ),
      governanceSequence ?? 1
    );
  }

  it("should not attest price updates with when required fee is not given", async function () {
    // Check initial fee is zero
    assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 0);

    // Set fee to 10
    await setFeeTo(this.pythProxy, 10);
    assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 10);

    let ts = 1647273460;
    let rawBatch1 = generateRawBatchAttestation(ts - 5, ts, 1337);
    let rawBatch2 = generateRawBatchAttestation(ts + 5, ts + 10, 1338);

    // Getting the fee from the contract
    let feeInWei = await this.pythProxy.methods["getUpdateFee(bytes[])"]([
      rawBatch1,
      rawBatch2,
    ]);
    assert.equal(feeInWei, 20);

    // When a smaller fee is payed it reverts
    await expectRevertCustomError(
      updatePriceFeeds(this.pythProxy, [rawBatch1, rawBatch2], feeInWei - 1),
      "InsufficientFee"
    );
  });

  it("should attest price updates with when required fee is given", async function () {
    // Check initial fee is zero
    assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 0);

    // Set fee to 10
    await setFeeTo(this.pythProxy, 10);
    assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 10);

    let ts = 1647273460;
    let rawBatch1 = generateRawBatchAttestation(ts - 5, ts, 1337);
    let rawBatch2 = generateRawBatchAttestation(ts + 5, ts + 10, 1338);

    // Getting the fee from the contract
    let feeInWei = await this.pythProxy.methods["getUpdateFee(bytes[])"]([
      rawBatch1,
      rawBatch2,
    ]);
    assert.equal(feeInWei, 20);

    await updatePriceFeeds(this.pythProxy, [rawBatch1, rawBatch2], feeInWei);
    const pythBalance = await web3.eth.getBalance(this.pythProxy.address);
    assert.equal(pythBalance, feeInWei);
  });

  it("should attest price updates with required fee even if more fee is given", async function () {
    // Check initial fee is zero
    assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 0);

    // Set fee to 10
    await setFeeTo(this.pythProxy, 10);
    assert.equal(await this.pythProxy.singleUpdateFeeInWei(), 10);

    let ts = 1647273460;
    let rawBatch1 = generateRawBatchAttestation(ts - 5, ts, 1337);
    let rawBatch2 = generateRawBatchAttestation(ts + 5, ts + 10, 1338);

    // Paying the fee works and extra fee is not paid back.
    let feeInWei = await this.pythProxy.methods["getUpdateFee(bytes[])"]([
      rawBatch1,
      rawBatch2,
    ]);
    assert.equal(feeInWei, 20);

    await updatePriceFeeds(
      this.pythProxy,
      [rawBatch1, rawBatch2],
      feeInWei + 10
    );
    const pythBalance = await web3.eth.getBalance(this.pythProxy.address);
    assert.equal(pythBalance, feeInWei + 10);
  });

  it("should cache price updates", async function () {
    let currentTimestamp = (await web3.eth.getBlock("latest")).timestamp;
    let priceVal = 521;
    let rawBatch = generateRawBatchAttestation(
      currentTimestamp - 5,
      currentTimestamp,
      priceVal
    );
    let receipt = await updatePriceFeeds(this.pythProxy, [rawBatch]);
    expectEvent(receipt, "PriceFeedUpdate", {
      price: priceVal.toString(),
      publishTime: (currentTimestamp - 5).toString(),
    });
    expectEvent(receipt, "BatchPriceFeedUpdate");

    let first_prod_id = "0x" + "01".repeat(32);
    let first_price_id = "0x" + "fe".repeat(32);
    let second_prod_id = "0x" + "02".repeat(32);
    let second_price_id = "0x" + "fd".repeat(32);

    // Confirm that previously non-existent feeds are created
    let first = await this.pythProxy.queryPriceFeed(first_price_id);
    console.debug(`first is ${JSON.stringify(first)}`);
    assert.equal(first.price.price, priceVal);

    let second = await this.pythProxy.queryPriceFeed(second_price_id);
    assert.equal(second.price.price, priceVal);

    // Confirm the price is bumped after a new attestation updates each record
    let nextTimestamp = currentTimestamp + 1;
    let rawBatch2 = generateRawBatchAttestation(
      nextTimestamp - 5,
      nextTimestamp,
      priceVal + 5
    );
    receipt = await updatePriceFeeds(this.pythProxy, [rawBatch2]);
    expectEvent(receipt, "PriceFeedUpdate", {
      price: (priceVal + 5).toString(),
      publishTime: (nextTimestamp - 5).toString(),
    });
    expectEvent(receipt, "BatchPriceFeedUpdate");

    first = await this.pythProxy.queryPriceFeed(first_price_id);
    assert.equal(first.price.price, priceVal + 5);

    second = await this.pythProxy.queryPriceFeed(second_price_id);
    assert.equal(second.price.price, priceVal + 5);

    // Confirm that only strictly larger timestamps trigger updates
    let rawBatch3 = generateRawBatchAttestation(
      nextTimestamp - 5,
      nextTimestamp,
      priceVal + 10
    );
    receipt = await updatePriceFeeds(this.pythProxy, [rawBatch3]);
    expectEvent.notEmitted(receipt, "PriceFeedUpdate");
    expectEvent(receipt, "BatchPriceFeedUpdate");

    first = await this.pythProxy.queryPriceFeed(first_price_id);
    assert.equal(first.price.price, priceVal + 5);
    assert.notEqual(first.price.price, priceVal + 10);

    second = await this.pythProxy.queryPriceFeed(second_price_id);
    assert.equal(second.price.price, priceVal + 5);
    assert.notEqual(second.price.price, priceVal + 10);
  });

  it("should fail transaction if a price is not found", async function () {
    await expectRevertCustomError(
      this.pythProxy.queryPriceFeed(
        "0xdeadfeeddeadfeeddeadfeeddeadfeeddeadfeeddeadfeeddeadfeeddeadfeed"
      ),
      "PriceFeedNotFound"
    );
  });

  it("should revert on getting stale current prices", async function () {
    let smallestTimestamp = 1;
    let rawBatch = generateRawBatchAttestation(
      smallestTimestamp,
      smallestTimestamp + 5,
      1337
    );
    await updatePriceFeeds(this.pythProxy, [rawBatch]);

    for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
      const price_id =
        "0x" + (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);
      await expectRevertCustomError(
        this.pythProxy.getPrice(price_id),
        "StalePrice"
      );
    }
  });

  it("should revert on getting current prices too far into the future as they are considered unknown", async function () {
    let largestTimestamp = 4294967295;
    let rawBatch = generateRawBatchAttestation(
      largestTimestamp - 5,
      largestTimestamp,
      1337
    );
    await updatePriceFeeds(this.pythProxy, [rawBatch]);

    for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
      const price_id =
        "0x" + (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);
      await expectRevertCustomError(
        this.pythProxy.getPrice(price_id),
        "StalePrice"
      );
    }
  });

  /**
   * Set valid time period to `newValidPeriod` by creating and submitting a
   * governance instruction for it.
   * @param contract Pyth contract
   * @param {number} newValidPeriod
   * @param {number=} governanceSequence Sequence number of the governance instruction. Defaults to 1.
   */
  async function setValidPeriodTo(
    contract,
    newValidPeriod,
    governanceSequence
  ) {
    await createAndThenSubmitGovernanceInstructionVaa(
      contract,
      new governance.SetValidPeriodInstruction(
        governance.CHAINS.ethereum,
        BigInt(newValidPeriod)
      ),
      governanceSequence ?? 1
    );
  }

  it("changing validity time works", async function () {
    const latestTime = await time.latest();
    let rawBatch = generateRawBatchAttestation(latestTime, latestTime, 1337);

    await updatePriceFeeds(this.pythProxy, [rawBatch]);

    // Setting the validity time to 30 seconds
    await setValidPeriodTo(this.pythProxy, 30, 1);
    assert.equal(await this.pythProxy.validTimePeriodSeconds(), 30);

    // Then prices should be available
    for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
      const price_id =
        "0x" + (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);

      // Expect getPrice to work (not revert)
      await this.pythProxy.getPrice(price_id);
    }

    // One minute passes
    await time.increase(time.duration.minutes(1));

    // The prices should become unavailable now.
    for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
      const price_id =
        "0x" + (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);

      await expectRevertCustomError(
        this.pythProxy.getPrice(price_id),
        "StalePrice"
      );
    }

    // Setting the validity time to 120 seconds
    await setValidPeriodTo(this.pythProxy, 120, 2);
    assert.equal(await this.pythProxy.validTimePeriodSeconds(), 120);

    // Then prices should be available because the valid period is now 120 seconds
    for (var i = 1; i <= RAW_BATCH_ATTESTATION_COUNT; i++) {
      const price_id =
        "0x" + (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);
      let priceFeedResult = await this.pythProxy.queryPriceFeed(price_id);

      // Expect getPrice to work (not revert)
      await this.pythProxy.getPrice(price_id);
    }
  });

  it("should use prev price and timestamp on unknown attestation status", async function () {
    const latestTime = await time.latest();
    let rawBatch = generateRawUnknownBatchAttestation(
      latestTime,
      latestTime,
      1337, // price
      1500, // ema price
      latestTime - 10,
      1000 // prev price
    );

    const receipt = await updatePriceFeeds(this.pythProxy, [rawBatch]);
    expectEvent(receipt, "PriceFeedUpdate", {
      price: "1000",
    });

    // Then prices should be available because the valid period is now 120 seconds
    for (var i = 1; i <= RAW_UNKNOWN_BATCH_ATTESTATION_COUNT; i++) {
      const price_id =
        "0x" + (255 - (i % 256)).toString(16).padStart(2, "0").repeat(32);

      const price = await this.pythProxy.getPrice(price_id);
      assert.equal(price.price, "1000");
      assert.equal(price.publishTime, (latestTime - 10).toString());

      const emaPrice = await this.pythProxy.getEmaPrice(price_id);
      assert.equal(emaPrice.price, "1500");
      assert.equal(emaPrice.publishTime, (latestTime - 10).toString());
    }
  });

  // Governance

  // Logics that apply to all governance messages
  it("Make sure invalid magic and module won't work", async function () {
    // First 4 bytes of data are magic and the second byte after that is module
    const data = new governance.SetValidPeriodInstruction(
      governance.CHAINS.ethereum,
      BigInt(10)
    ).serialize();

    const wrongMagic = Buffer.from(data);
    wrongMagic[1] = 0;

    const vaaWrongMagic = await createVAAFromUint8Array(
      wrongMagic,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaaWrongMagic),
      "InvalidGovernanceMessage"
    );

    const wrongModule = Buffer.from(data);
    wrongModule[4] = 0;

    const vaaWrongModule = await createVAAFromUint8Array(
      wrongModule,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaaWrongModule),
      "InvalidGovernanceTarget"
    );

    const outOfBoundModule = Buffer.from(data);
    outOfBoundModule[4] = 20;

    const vaaOutOfBoundModule = await createVAAFromUint8Array(
      outOfBoundModule,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    await expectRevert(
      this.pythProxy.executeGovernanceInstruction(vaaOutOfBoundModule),
      "Panic: Enum value out of bounds."
    );
  });

  it("Make sure governance with wrong sender won't work", async function () {
    const data = new governance.SetValidPeriodInstruction(
      governance.CHAINS.ethereum,
      BigInt(10)
    ).serialize();

    const vaaWrongEmitter = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      "0x0000000000000000000000000000000000000000000000000000000000001111",
      1
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaaWrongEmitter),
      "InvalidGovernanceDataSource"
    );

    const vaaWrongChain = await createVAAFromUint8Array(
      data,
      governance.CHAINS.karura,
      testGovernanceEmitter,
      1
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaaWrongChain),
      "InvalidGovernanceDataSource"
    );
  });

  it("Make sure governance with only target chain id and 0 work", async function () {
    const wrongChainData = new governance.SetValidPeriodInstruction(
      governance.CHAINS.solana,
      BigInt(10)
    ).serialize();

    const wrongChainVaa = await createVAAFromUint8Array(
      wrongChainData,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(wrongChainVaa),
      "InvalidGovernanceTarget"
    );

    const dataForAllChains = new governance.SetValidPeriodInstruction(
      governance.CHAINS.unset,
      BigInt(10)
    ).serialize();

    const vaaForAllChains = await createVAAFromUint8Array(
      dataForAllChains,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    await this.pythProxy.executeGovernanceInstruction(vaaForAllChains);

    const dataForEth = new governance.SetValidPeriodInstruction(
      governance.CHAINS.ethereum,
      BigInt(10)
    ).serialize();

    const vaaForEth = await createVAAFromUint8Array(
      dataForEth,
      testGovernanceChainId,
      testGovernanceEmitter,
      2
    );

    await this.pythProxy.executeGovernanceInstruction(vaaForEth);
  });

  it("Make sure that governance messages are executed in order and cannot be reused", async function () {
    const data = new governance.SetValidPeriodInstruction(
      governance.CHAINS.ethereum,
      BigInt(10)
    ).serialize();

    const vaaSeq1 = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    await this.pythProxy.executeGovernanceInstruction(vaaSeq1),
      // Replaying shouldn't work
      await expectRevertCustomError(
        this.pythProxy.executeGovernanceInstruction(vaaSeq1),
        "OldGovernanceMessage"
      );

    const vaaSeq2 = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      2
    );

    await this.pythProxy.executeGovernanceInstruction(vaaSeq2),
      // Replaying shouldn't work
      await expectRevertCustomError(
        this.pythProxy.executeGovernanceInstruction(vaaSeq1),
        "OldGovernanceMessage"
      );
    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaaSeq2),
      "OldGovernanceMessage"
    );
  });

  // Per governance type logic
  it("Upgrading the contract with chain id 0 is invalid", async function () {
    const newImplementation = await PythUpgradable.new();

    const data = new governance.EthereumUpgradeContractInstruction(
      governance.CHAINS.unset, // 0
      new governance.HexString20Bytes(newImplementation.address)
    ).serialize();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaa),
      "InvalidGovernanceTarget"
    );
  });

  it("Upgrading the contract should work", async function () {
    const newImplementation = await PythUpgradable.new();

    const data = new governance.EthereumUpgradeContractInstruction(
      governance.CHAINS.ethereum,
      new governance.HexString20Bytes(newImplementation.address)
    ).serialize();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    const receipt = await this.pythProxy.executeGovernanceInstruction(vaa);

    // Couldn't get the oldImplementation address.
    expectEvent(receipt, "ContractUpgraded", {
      newImplementation: newImplementation.address,
    });
    expectEvent(receipt, "Upgraded", {
      implementation: newImplementation.address,
    });
  });

  it("Upgrading the contract to a non-pyth contract won't work", async function () {
    const newImplementation = await MockUpgradeableProxy.new();

    const data = new governance.EthereumUpgradeContractInstruction(
      governance.CHAINS.ethereum,
      new governance.HexString20Bytes(newImplementation.address)
    ).serialize();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    // Calling a non-existing method will cause a revert with no explanation.
    await expectRevert(
      this.pythProxy.executeGovernanceInstruction(vaa),
      "revert"
    );
  });

  it("Transferring governance data source should work", async function () {
    const newEmitterAddress =
      "0x0000000000000000000000000000000000000000000000000000000000001111";
    const newEmitterChain = governance.CHAINS.acala;

    const claimInstructionData =
      new governance.RequestGovernanceDataSourceTransferInstruction(
        governance.CHAINS.unset,
        1
      ).serialize();

    const claimVaaHexString = await createVAAFromUint8Array(
      claimInstructionData,
      newEmitterChain,
      newEmitterAddress,
      1
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(claimVaaHexString),
      "InvalidGovernanceDataSource"
    );

    const claimVaa = Buffer.from(claimVaaHexString.substring(2), "hex");

    const data =
      new governance.AuthorizeGovernanceDataSourceTransferInstruction(
        governance.CHAINS.unset,
        claimVaa
      ).serialize();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    const oldGovernanceDataSource = await this.pythProxy.governanceDataSource();

    const receipt = await this.pythProxy.executeGovernanceInstruction(vaa);

    const newGovernanceDataSource = await this.pythProxy.governanceDataSource();

    expectEvent(receipt, "GovernanceDataSourceSet", {
      oldDataSource: oldGovernanceDataSource,
      newDataSource: newGovernanceDataSource,
    });

    expect(newGovernanceDataSource.chainId).equal(newEmitterChain.toString());
    expect(newGovernanceDataSource.emitterAddress).equal(newEmitterAddress);

    // Verifies the data source has changed.
    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaa),
      "InvalidGovernanceDataSource"
    );

    // Make sure a claim vaa does not get executed

    const claimLonely =
      new governance.RequestGovernanceDataSourceTransferInstruction(
        governance.CHAINS.unset,
        2
      ).serialize();

    const claimLonelyVaa = await createVAAFromUint8Array(
      claimLonely,
      newEmitterChain,
      newEmitterAddress,
      2
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(claimLonelyVaa),
      "InvalidGovernanceMessage"
    );

    // Transfer back the ownership to the old governance data source without increasing
    // the governance index should not work

    // A wrong vaa that does not move the governance index
    const transferBackClaimInstructionDataWrong =
      new governance.RequestGovernanceDataSourceTransferInstruction(
        governance.CHAINS.unset,
        1 // The same governance data source index => Should fail
      ).serialize();

    const transferBackClaimVaaHexStringWrong = await createVAAFromUint8Array(
      transferBackClaimInstructionDataWrong,
      testGovernanceChainId,
      testGovernanceEmitter,
      2
    );

    const transferBackClaimVaaWrong = Buffer.from(
      transferBackClaimVaaHexStringWrong.substring(2),
      "hex"
    );

    const transferBackDataWrong =
      new governance.AuthorizeGovernanceDataSourceTransferInstruction(
        governance.CHAINS.unset,
        transferBackClaimVaaWrong
      ).serialize();

    const transferBackVaaWrong = await createVAAFromUint8Array(
      transferBackDataWrong,
      newEmitterChain,
      newEmitterAddress,
      2
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(transferBackVaaWrong),
      "OldGovernanceMessage"
    );
  });

  it("Setting data sources should work", async function () {
    const data = new governance.SetDataSourcesInstruction(
      governance.CHAINS.ethereum,
      [
        new governance.DataSource(
          governance.CHAINS.acala,
          new governance.HexString32Bytes(
            "0x0000000000000000000000000000000000000000000000000000000000001111"
          )
        ),
      ]
    ).serialize();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    const oldDataSources = await this.pythProxy.validDataSources();

    const receipt = await this.pythProxy.executeGovernanceInstruction(vaa);
    expectEvent(receipt, "DataSourcesSet", {
      oldDataSources: oldDataSources,
      newDataSources: await this.pythProxy.validDataSources(),
    });

    assert.isTrue(
      await this.pythProxy.isValidDataSource(
        governance.CHAINS.acala,
        "0x0000000000000000000000000000000000000000000000000000000000001111"
      )
    );
    assert.isFalse(
      await this.pythProxy.isValidDataSource(
        testPyth2WormholeChainId,
        testPyth2WormholeEmitter
      )
    );

    let rawBatch = generateRawBatchAttestation(100, 100, 1337);
    await expectRevertCustomError(
      updatePriceFeeds(this.pythProxy, [rawBatch]),
      "InvalidUpdateDataSource"
    );

    await updatePriceFeeds(
      this.pythProxy,
      [rawBatch],
      0,
      governance.CHAINS.acala,
      "0x0000000000000000000000000000000000000000000000000000000000001111"
    );
  });

  it("Setting fee should work", async function () {
    const data = new governance.SetFeeInstruction(
      governance.CHAINS.ethereum,
      BigInt(5),
      BigInt(3) // 5*10**3 = 5000
    ).serialize();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    const oldFee = await this.pythProxy.singleUpdateFeeInWei();

    const receipt = await this.pythProxy.executeGovernanceInstruction(vaa);
    expectEvent(receipt, "FeeSet", {
      oldFee: oldFee,
      newFee: await this.pythProxy.singleUpdateFeeInWei(),
    });

    assert.equal(await this.pythProxy.singleUpdateFeeInWei(), "5000");

    let rawBatch = generateRawBatchAttestation(100, 100, 1337);
    await expectRevertCustomError(
      updatePriceFeeds(this.pythProxy, [rawBatch], 0),
      "InsufficientFee"
    );

    await updatePriceFeeds(this.pythProxy, [rawBatch], 5000);
  });

  it("Setting valid period should work", async function () {
    const data = new governance.SetValidPeriodInstruction(
      governance.CHAINS.ethereum,
      BigInt(0)
    ).serialize();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1
    );

    const oldValidPeriod = await this.pythProxy.validTimePeriodSeconds();

    const receipt = await this.pythProxy.executeGovernanceInstruction(vaa);
    expectEvent(receipt, "ValidPeriodSet", {
      oldValidPeriod: oldValidPeriod,
      newValidPeriod: await this.pythProxy.validTimePeriodSeconds(),
    });

    assert.equal(await this.pythProxy.validTimePeriodSeconds(), "0");

    // The behaviour of valid time period is extensively tested before,
    // and adding it here will cause more complexity (and is not so short).
  });

  // Version

  it("Make sure version is the npm package version", async function () {
    const contractVersion = await this.pythProxy.version();
    const { version } = require("../package.json");

    expect(contractVersion).equal(version);
  });
});

const signAndEncodeVM = async function (
  timestamp,
  nonce,
  emitterChainId,
  emitterAddress,
  sequence,
  data,
  signers,
  guardianSetIndex,
  consistencyLevel
) {
  const body = [
    web3.eth.abi.encodeParameter("uint32", timestamp).substring(2 + (64 - 8)),
    web3.eth.abi.encodeParameter("uint32", nonce).substring(2 + (64 - 8)),
    web3.eth.abi
      .encodeParameter("uint16", emitterChainId)
      .substring(2 + (64 - 4)),
    web3.eth.abi.encodeParameter("bytes32", emitterAddress).substring(2),
    web3.eth.abi.encodeParameter("uint64", sequence).substring(2 + (64 - 16)),
    web3.eth.abi
      .encodeParameter("uint8", consistencyLevel)
      .substring(2 + (64 - 2)),
    data.substr(2),
  ];

  const hash = web3.utils.soliditySha3(
    web3.utils.soliditySha3("0x" + body.join(""))
  );

  let signatures = "";

  for (let i in signers) {
    const ec = new elliptic.ec("secp256k1");
    const key = ec.keyFromPrivate(signers[i]);
    const signature = key.sign(hash.substr(2), { canonical: true });

    const packSig = [
      web3.eth.abi.encodeParameter("uint8", i).substring(2 + (64 - 2)),
      zeroPadBytes(signature.r.toString(16), 32),
      zeroPadBytes(signature.s.toString(16), 32),
      web3.eth.abi
        .encodeParameter("uint8", signature.recoveryParam)
        .substr(2 + (64 - 2)),
    ];

    signatures += packSig.join("");
  }

  const vm = [
    web3.eth.abi.encodeParameter("uint8", 1).substring(2 + (64 - 2)),
    web3.eth.abi
      .encodeParameter("uint32", guardianSetIndex)
      .substring(2 + (64 - 8)),
    web3.eth.abi
      .encodeParameter("uint8", signers.length)
      .substring(2 + (64 - 2)),

    signatures,
    body.join(""),
  ].join("");

  return vm;
};

function zeroPadBytes(value, length) {
  while (value.length < 2 * length) {
    value = "0" + value;
  }
  return value;
}

async function createVAAFromUint8Array(
  dataBuffer,
  emitterChainId,
  emitterAddress,
  sequence
) {
  const dataHex = "0x" + dataBuffer.toString("hex");
  return (
    "0x" +
    (await signAndEncodeVM(
      0,
      0,
      emitterChainId.toString(),
      emitterAddress,
      sequence,
      dataHex,
      [testSigner1PK],
      0,
      0
    ))
  );
}

// There is no way to check event with given args has not emitted with expectEvent
// or how many times an event was emitted. This function is implemented to count
// the matching events and is used for the mentioned purposes.
function getNumMatchingEvents(receipt, eventName, args) {
  let matchCnt = 0;
  for (let log of receipt.logs) {
    if (log.event === eventName) {
      let match = true;
      for (let argKey in args) {
        if (log.args[argKey].toString() !== args[argKey].toString()) {
          match = false;
          break;
        }
      }
      if (match) {
        matchCnt++;
      }
    }
  }
  return matchCnt;
}

function expectEventNotEmittedWithArgs(receipt, eventName, args) {
  const matches = getNumMatchingEvents(receipt, eventName, args);
  assert(
    matches === 0,
    `Expected no matching emitted event. But found ${matches}.`
  );
}

function expectEventMultipleTimes(receipt, eventName, args, cnt) {
  const matches = getNumMatchingEvents(receipt, eventName, args);
  assert(matches === cnt, `Expected ${cnt} event matches, found ${matches}.`);
}

async function expectRevertCustomError(promise, reason) {
  try {
    await promise;
    expect.fail("Expected promise to throw but it didn't");
  } catch (revert) {
    if (reason) {
      const reasonId = web3.utils.keccak256(reason + "()").substr(0, 10);
      expect(
        JSON.stringify(revert),
        `Expected custom error ${reason} (${reasonId})`
      ).to.include(reasonId);
    }
  }
}
