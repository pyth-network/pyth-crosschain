const elliptic = require("elliptic");
const governance = require("@pythnetwork/xc-admin-common");

const { deployProxy, upgradeProxy } = require("@openzeppelin/truffle-upgrades");
const {
  expectRevert,
  expectEvent,
  time,
} = require("@openzeppelin/test-helpers");
const { assert, expect } = require("chai");
const { EvmSetWormholeAddress } = require("@pythnetwork/xc-admin-common");

// Use "WormholeReceiver" if you are testing with Wormhole Receiver
const Setup = artifacts.require("Setup");
const Implementation = artifacts.require("Implementation");
const Wormhole = artifacts.require("Wormhole");

const ReceiverSetup = artifacts.require("ReceiverSetup");
const ReceiverImplementation = artifacts.require("ReceiverImplementation");
const WormholeReceiver = artifacts.require("WormholeReceiver");

const wormholeGovernanceChainId = governance.CHAINS.solana;
const wormholeGovernanceContract =
  "0x0000000000000000000000000000000000000000000000000000000000000004";

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
      testPyth2WormholeEmitter,
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
      "Ownable: caller is not the owner.",
    );
  });

  async function updatePriceFeeds(
    contract,
    batches,
    valueInWei,
    chainId,
    emitter,
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
        0,
      );
      updateData.push("0x" + vm);
    }
    return await contract.updatePriceFeeds(updateData, { value: valueInWei });
  }

  /**
   * Create a governance instruction VAA from the Instruction object. Then
   * Submit and execute it on the contract.
   * @param contract Pyth contract
   * @param {governance.PythGovernanceAction} governanceInstruction
   * @param {number} sequence
   */
  async function createAndThenSubmitGovernanceInstructionVaa(
    contract,
    governanceInstruction,
    sequence,
  ) {
    await contract.executeGovernanceInstruction(
      await createVAAFromUint8Array(
        governanceInstruction.encode(),
        testGovernanceChainId,
        testGovernanceEmitter,
        sequence,
      ),
    );
  }

  it("should attest price updates empty", async function () {
    const receipt = await updatePriceFeeds(this.pythProxy, []);
    expectEvent.notEmitted(receipt, "PriceFeedUpdate");
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
      new governance.SetFee("ethereum", BigInt(newFee), BigInt(0)),
      governanceSequence ?? 1,
    );
  }

  it("should fail transaction if a price is not found", async function () {
    await expectRevertCustomError(
      this.pythProxy.queryPriceFeed(
        "0xdeadfeeddeadfeeddeadfeeddeadfeeddeadfeeddeadfeeddeadfeeddeadfeed",
      ),
      "PriceFeedNotFound",
    );
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
    governanceSequence,
  ) {
    await createAndThenSubmitGovernanceInstructionVaa(
      contract,
      new governance.SetValidPeriod("ethereum", BigInt(newValidPeriod)),
      governanceSequence ?? 1,
    );
  }

  // Governance

  // Logics that apply to all governance messages
  it("Make sure invalid magic and module won't work", async function () {
    // First 4 bytes of data are magic and the second byte after that is module
    const data = new governance.SetValidPeriod("ethereum", BigInt(10)).encode();

    const wrongMagic = Buffer.from(data);
    wrongMagic[1] = 0;

    const vaaWrongMagic = await createVAAFromUint8Array(
      wrongMagic,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaaWrongMagic),
      "InvalidGovernanceMessage",
    );

    const wrongModule = Buffer.from(data);
    wrongModule[4] = 0;

    const vaaWrongModule = await createVAAFromUint8Array(
      wrongModule,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaaWrongModule),
      "InvalidGovernanceTarget",
    );

    const outOfBoundModule = Buffer.from(data);
    outOfBoundModule[4] = 20;

    const vaaOutOfBoundModule = await createVAAFromUint8Array(
      outOfBoundModule,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
    );

    await expectRevert(
      this.pythProxy.executeGovernanceInstruction(vaaOutOfBoundModule),
      "Panic: Enum value out of bounds.",
    );
  });

  it("Make sure governance with wrong sender won't work", async function () {
    const data = new governance.SetValidPeriod("ethereum", BigInt(10)).encode();

    const vaaWrongEmitter = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      "0x0000000000000000000000000000000000000000000000000000000000001111",
      1,
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaaWrongEmitter),
      "InvalidGovernanceDataSource",
    );

    const vaaWrongChain = await createVAAFromUint8Array(
      data,
      governance.CHAINS.karura,
      testGovernanceEmitter,
      1,
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaaWrongChain),
      "InvalidGovernanceDataSource",
    );
  });

  it("Make sure governance with only target chain id and 0 work", async function () {
    const wrongChainData = new governance.SetValidPeriod(
      "solana",
      BigInt(10),
    ).encode();

    const wrongChainVaa = await createVAAFromUint8Array(
      wrongChainData,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(wrongChainVaa),
      "InvalidGovernanceTarget",
    );

    const dataForAllChains = new governance.SetValidPeriod(
      "unset",
      BigInt(10),
    ).encode();

    const vaaForAllChains = await createVAAFromUint8Array(
      dataForAllChains,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
    );

    await this.pythProxy.executeGovernanceInstruction(vaaForAllChains);

    const dataForEth = new governance.SetValidPeriod(
      "ethereum",
      BigInt(10),
    ).encode();

    const vaaForEth = await createVAAFromUint8Array(
      dataForEth,
      testGovernanceChainId,
      testGovernanceEmitter,
      2,
    );

    await this.pythProxy.executeGovernanceInstruction(vaaForEth);
  });

  it("Make sure that governance messages are executed in order and cannot be reused", async function () {
    const data = new governance.SetValidPeriod("ethereum", BigInt(10)).encode();

    const vaaSeq1 = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
    );

    await this.pythProxy.executeGovernanceInstruction(vaaSeq1),
      // Replaying shouldn't work
      await expectRevertCustomError(
        this.pythProxy.executeGovernanceInstruction(vaaSeq1),
        "OldGovernanceMessage",
      );

    const vaaSeq2 = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      2,
    );

    await this.pythProxy.executeGovernanceInstruction(vaaSeq2),
      // Replaying shouldn't work
      await expectRevertCustomError(
        this.pythProxy.executeGovernanceInstruction(vaaSeq1),
        "OldGovernanceMessage",
      );
    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaaSeq2),
      "OldGovernanceMessage",
    );
  });

  // Per governance type logic
  it("Upgrading the contract with chain id 0 is invalid", async function () {
    const newImplementation = await PythUpgradable.new();

    const data = new governance.EvmUpgradeContract(
      "unset", // 0
      newImplementation.address.replace("0x", ""),
    ).encode();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(vaa),
      "InvalidGovernanceTarget",
    );
  });

  it("Upgrading the contract should work", async function () {
    const newImplementation = await PythUpgradable.new();

    const data = new governance.EvmUpgradeContract(
      "ethereum",
      newImplementation.address.replace("0x", ""),
    ).encode();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
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

    const data = new governance.EvmUpgradeContract(
      "ethereum",
      newImplementation.address.replace("0x", ""),
    ).encode();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
    );

    // Calling a non-existing method will cause a revert with no explanation.
    await expectRevert(
      this.pythProxy.executeGovernanceInstruction(vaa),
      "revert",
    );
  });

  it("Transferring governance data source should work", async function () {
    const newEmitterAddress =
      "0x0000000000000000000000000000000000000000000000000000000000001111";
    const newEmitterChain = governance.CHAINS.acala;

    const claimInstructionData =
      new governance.RequestGovernanceDataSourceTransfer("unset", 1).encode();

    const claimVaaHexString = await createVAAFromUint8Array(
      claimInstructionData,
      newEmitterChain,
      newEmitterAddress,
      1,
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(claimVaaHexString),
      "InvalidGovernanceDataSource",
    );

    const claimVaa = Buffer.from(claimVaaHexString.substring(2), "hex");

    const data = new governance.AuthorizeGovernanceDataSourceTransfer(
      "unset",
      claimVaa,
    ).encode();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
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
      "InvalidGovernanceDataSource",
    );

    // Make sure a claim vaa does not get executed

    const claimLonely = new governance.RequestGovernanceDataSourceTransfer(
      "unset",
      2,
    ).encode();

    const claimLonelyVaa = await createVAAFromUint8Array(
      claimLonely,
      newEmitterChain,
      newEmitterAddress,
      2,
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(claimLonelyVaa),
      "InvalidGovernanceMessage",
    );

    // Transfer back the ownership to the old governance data source without increasing
    // the governance index should not work

    // A wrong vaa that does not move the governance index
    const transferBackClaimInstructionDataWrong =
      new governance.RequestGovernanceDataSourceTransfer(
        "unset",
        1, // The same governance data source index => Should fail
      ).encode();

    const transferBackClaimVaaHexStringWrong = await createVAAFromUint8Array(
      transferBackClaimInstructionDataWrong,
      testGovernanceChainId,
      testGovernanceEmitter,
      2,
    );

    const transferBackClaimVaaWrong = Buffer.from(
      transferBackClaimVaaHexStringWrong.substring(2),
      "hex",
    );

    const transferBackDataWrong =
      new governance.AuthorizeGovernanceDataSourceTransfer(
        "unset",
        transferBackClaimVaaWrong,
      ).encode();

    const transferBackVaaWrong = await createVAAFromUint8Array(
      transferBackDataWrong,
      newEmitterChain,
      newEmitterAddress,
      2,
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(transferBackVaaWrong),
      "OldGovernanceMessage",
    );
  });

  it("Setting data sources should work", async function () {
    const data = new governance.SetDataSources("ethereum", [
      {
        emitterChain: governance.CHAINS.acala,
        emitterAddress:
          "0000000000000000000000000000000000000000000000000000000000001111",
      },
    ]).encode();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
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
        "0x0000000000000000000000000000000000000000000000000000000000001111",
      ),
    );
    assert.isFalse(
      await this.pythProxy.isValidDataSource(
        testPyth2WormholeChainId,
        testPyth2WormholeEmitter,
      ),
    );

    // TODO: try to publish prices
  });

  it("Setting fee should work", async function () {
    const data = new governance.SetFee(
      "ethereum",
      BigInt(5),
      BigInt(3), // 5*10**3 = 5000
    ).encode();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
    );

    const oldFee = await this.pythProxy.singleUpdateFeeInWei();

    const receipt = await this.pythProxy.executeGovernanceInstruction(vaa);
    expectEvent(receipt, "FeeSet", {
      oldFee: oldFee,
      newFee: await this.pythProxy.singleUpdateFeeInWei(),
    });

    assert.equal(await this.pythProxy.singleUpdateFeeInWei(), "5000");

    // TODO: check that fee is applied
  });

  it("Setting valid period should work", async function () {
    const data = new governance.SetValidPeriod("ethereum", BigInt(0)).encode();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
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

  it("Setting wormhole address should work", async function () {
    // Deploy a new wormhole contract
    const newSetup = await Setup.new();
    const newImpl = await Implementation.new();

    // encode initialisation data
    const initData = newSetup.contract.methods
      .setup(
        newImpl.address,
        [testSigner1.address],
        governance.CHAINS.polygon, // changing the chain id to polygon
        wormholeGovernanceChainId,
        wormholeGovernanceContract,
      )
      .encodeABI();

    const newWormhole = await Wormhole.new(newSetup.address, initData);

    // Creating the vaa to set the new wormhole address
    const data = new governance.EvmSetWormholeAddress(
      "ethereum",
      newWormhole.address.replace("0x", ""),
    ).encode();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
    );

    assert.equal(await this.pythProxy.chainId(), governance.CHAINS.ethereum);

    const oldWormholeAddress = await this.pythProxy.wormhole();

    const receipt = await this.pythProxy.executeGovernanceInstruction(vaa);
    expectEvent(receipt, "WormholeAddressSet", {
      oldWormholeAddress: oldWormholeAddress,
      newWormholeAddress: newWormhole.address,
    });

    assert.equal(await this.pythProxy.wormhole(), newWormhole.address);
    assert.equal(await this.pythProxy.chainId(), governance.CHAINS.polygon);
  });

  it("Setting wormhole address to WormholeReceiver should work", async function () {
    // Deploy a new wormhole receiver contract
    const newReceiverSetup = await ReceiverSetup.new();
    const newReceiverImpl = await ReceiverImplementation.new();

    // encode initialisation data
    const initData = newReceiverSetup.contract.methods
      .setup(
        newReceiverImpl.address,
        [testSigner1.address],
        governance.CHAINS.polygon, // changing the chain id to polygon
        wormholeGovernanceChainId,
        wormholeGovernanceContract,
      )
      .encodeABI();

    const newWormholeReceiver = await WormholeReceiver.new(
      newReceiverSetup.address,
      initData,
    );

    // Creating the vaa to set the new wormhole address
    const data = new governance.EvmSetWormholeAddress(
      "ethereum",
      newWormholeReceiver.address.replace("0x", ""),
    ).encode();

    const vaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
    );

    assert.equal(await this.pythProxy.chainId(), governance.CHAINS.ethereum);

    const oldWormholeAddress = await this.pythProxy.wormhole();

    const receipt = await this.pythProxy.executeGovernanceInstruction(vaa);
    expectEvent(receipt, "WormholeAddressSet", {
      oldWormholeAddress: oldWormholeAddress,
      newWormholeAddress: newWormholeReceiver.address,
    });

    assert.equal(await this.pythProxy.wormhole(), newWormholeReceiver.address);
    assert.equal(await this.pythProxy.chainId(), governance.CHAINS.polygon);
  });

  it("Setting wormhole address to a wrong contract should reject", async function () {
    // Deploy a new wormhole contract
    const newSetup = await Setup.new();
    const newImpl = await Implementation.new();

    // encode initialisation data
    const initData = newSetup.contract.methods
      .setup(
        newImpl.address,
        [testSigner2.address], // A wrong signer
        governance.CHAINS.ethereum,
        wormholeGovernanceChainId,
        wormholeGovernanceContract,
      )
      .encodeABI();

    const newWormhole = await Wormhole.new(newSetup.address, initData);

    // Creating the vaa to set the new wormhole address
    const data = new governance.EvmSetWormholeAddress(
      "ethereum",
      newWormhole.address.replace("0x", ""),
    ).encode();

    const wrongVaa = await createVAAFromUint8Array(
      data,
      testGovernanceChainId,
      testGovernanceEmitter,
      1,
    );

    await expectRevertCustomError(
      this.pythProxy.executeGovernanceInstruction(wrongVaa),
      "InvalidGovernanceMessage",
    );
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
  consistencyLevel,
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
    web3.utils.soliditySha3("0x" + body.join("")),
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
  sequence,
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
      0,
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
    `Expected no matching emitted event. But found ${matches}.`,
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
        `Expected custom error ${reason} (${reasonId})`,
      ).to.include(reasonId);
    }
  }
}
