const governance = require("@pythnetwork/xc-governance-sdk");
const wormhole = require("@certusone/wormhole-sdk");
const assertVaaPayloadEquals = require("./assertVaaPayloadEquals");
const { assert } = require("chai");
const util = require("node:util");
const exec = util.promisify(require("node:child_process").exec);
const fs = require("fs");

const loadEnv = require("./loadEnv");
loadEnv("../");

const network = process.env.MIGRATIONS_NETWORK;
const chainName = process.env.WORMHOLE_CHAIN_NAME;
const cluster = process.env.CLUSTER;
const PythUpgradable = artifacts.require("PythUpgradable");

/**
 *
 * @param {string} cmd
 * @returns {Promise<string>} output of the multisig command
 */
async function execMultisigCommand(cmd) {
  const multisigCluster = cluster === "mainnet" ? "mainnet" : "devnet";
  const fullCmd = `npm start -- ${cmd} -c ${multisigCluster}`;
  console.log(`Executing "${fullCmd}"`);

  const { stdout, stderr } = await exec(fullCmd, {
    cwd: "../third_party/pyth/multisig-wh-message-builder",
  });

  console.log("stdout:");
  console.log(stdout);
  console.log("stderr");
  console.log(stderr);

  return stdout;
}

/**
 *
 * @param {string} payload Payload in hex string without leading 0x
 * @returns {Promise<string>}
 */
async function createMultisigTx(payload) {
  console.log("Creating a multisig transaction for this transaction");
  const stdout = await execMultisigCommand(`create -p ${payload}`);

  const txKey = stdout.match(/Tx key: (.*)\n/)[1];
  assert(txKey !== undefined && txKey.length > 10);
  console.log(`Created a multisig tx with key: ${txKey}`);

  return txKey;
}

/**
 *
 * @param {string} txKey
 * @param {string} payload
 * @returns {Promise<string>} VAA for the tx as hex (without leading 0x).
 */
async function executeMultisigTxAndGetVaa(txKey) {
  console.log("Executing a multisig transaction for this transaction");
  const stdout = await execMultisigCommand(`execute -t ${txKey}`);

  let /** @type {string} */ vaa;
  try {
    vaa = stdout.match(/VAA \(Hex\): (.*)\n/)[1];
    assert(vaa !== undefined && vaa.length > 10);
  } catch (err) {
    throw new Error("Couldn't find VAA from the logs.");
  }

  console.log(`Executed multisig tx and got VAA: ${vaa}`);

  return vaa;
}

/**
 *
 * @param {Buffer} payload
 */
function cleanUpVaaCache(payload) {
  fs.rmSync(`.${network}.ms_vaa_${payload.toString("hex")}`);
}

/**
 *
 * @param {Buffer} payload
 * @returns {Promise<string>} VAA for the tx as hex (without leading 0x).
 */
async function createVaaFromPayloadThroughMultiSig(payload) {
  const payloadHex = payload.toString("hex");

  const msVaaCachePath = `.${network}.ms_vaa_${payloadHex}`;
  let vaa;
  if (fs.existsSync(msVaaCachePath)) {
    vaa = fs.readFileSync(msVaaCachePath).toString().trim();
    console.log(`VAA already exists: ${vaa}`);
    return vaa;
  } else {
    const msTxCachePath = `.${network}.ms_tx_${payloadHex}`;

    let txKey;
    if (fs.existsSync(msTxCachePath)) {
      txKey = fs.readFileSync(msTxCachePath).toString();
    } else {
      console.log(
        `Creating multisig to send VAA with this payload: ${payloadHex} ...`
      );
      txKey = await createMultisigTx(payloadHex);
      fs.writeFileSync(msTxCachePath, txKey);
      throw new Error(
        "Contract not sync yet. Run the script again once the multisig transaction is ready to be executed."
      );
    }

    try {
      vaa = await executeMultisigTxAndGetVaa(txKey, payloadHex);
    } catch (e) {
      console.error(e);
      throw new Error(
        "Could not execute multisig tx. If the transaction is executed please get the VAA manually " +
          `and put it on .${network}.ms_vaa_${payloadHex}. Then execute the script again.`
      );
    }

    fs.writeFileSync(msVaaCachePath, vaa);
    fs.rmSync(`.${network}.ms_tx_${payloadHex}`);
  }

  return vaa;
}

/**
 * Create a VAA from Payload through multisig.
 *
 * @param {Buffer} payload
 * @returns {Promise<void>}
 */
async function createAndExecuteVaaFromPayloadThroughMultiSig(payload) {
  const vaa = await createVaaFromPayloadThroughMultiSig(payload);

  assertVaaPayloadEquals(vaa, payload);

  console.log(`Executing the VAA...`);
  await proxy.executeGovernanceInstruction("0x" + vaa);

  cleanUpVaaCache(payload);
}

async function enesureWormholeAddrAndChainIdIsCorrect(proxy) {
  let desiredWormholeAddr;
  if (governance.RECEIVER_CHAINS[chainName] !== undefined) {
    const WormholeReceiver = artifacts.require("WormholeReceiver");
    desiredWormholeAddr = (await WormholeReceiver.deployed()).address;
  } else {
    desiredWormholeAddr =
      wormhole.CONTRACTS[cluster.toUpperCase()][chainName].core;
  }

  assert(desiredWormholeAddr !== undefined);

  const onchainWormholeAddr = await proxy.wormhole();
  assert(desiredWormholeAddr == onchainWormholeAddr);

  const desiredChainId = governance.CHAINS[chainName];
  const onchainChainId = await proxy.chainId();
  assert(desiredChainId == onchainChainId);

  console.log(
    `✅ Wormhole address and chain id is correct: ${desiredWormholeAddr} chainId: ${desiredChainId}`
  );
}

async function ensureThereIsNoOwner(proxy) {
  const onchainOwner = await proxy.owner();
  assert(onchainOwner == "0x0000000000000000000000000000000000000000");
  console.log("✅ There is no owner");
}

/**
 *
 * @param {} proxy
 * @param {string} desiredVersion
 */
async function govUpgradeContract(proxy, desiredVersion) {
  const implCachePath = `.${network}.new_impl`;
  let newImplementationAddress;
  if (fs.existsSync(implCachePath)) {
    newImplementationAddress = fs.readFileSync(implCachePath).toString();
    console.log(
      `A new implementation has already been deployed at address ${newImplementationAddress}`
    );
  } else {
    console.log("Deploying a new implementation...");
    const newImplementation = await PythUpgradable.new();
    console.log(`Tx hash:  ${newImplementation.transactionHash}`);
    console.log(`New implementation address: ${newImplementation.address}`);
    fs.writeFileSync(implCachePath, newImplementation.address);
    newImplementationAddress = newImplementation.address;
  }

  const upgradePayload = new governance.EthereumUpgradeContractInstruction(
    governance.CHAINS[chainName],
    new governance.HexString20Bytes(newImplementationAddress)
  ).serialize();

  const upgradePayloadHex = upgradePayload.toString("hex");

  await createAndExecuteVaaFromPayloadThroughMultiSig(upgradePayload);

  fs.rmSync(implCachePath);
  cleanUpVaaCache(upgradePayloadHex);

  const newVersion = await proxy.version();
  assert(desiredVersion == newVersion, "New contract version is not a match");

  console.log(`✅ Contract upgraded successfully`);
}

async function syncContractCode(proxy) {
  const onchainVersion = await proxy.version();
  const { version: desiredVersion } = require("../package.json");

  if (onchainVersion === desiredVersion) {
    console.log(`✅ Contract version is up to date: ${desiredVersion}`);
  } else {
    console.log(
      `❌ On-chain contract is outdated. Deployed version: ${onchainVersion}, desired version: ${desiredVersion}. Upgrading...`
    );
    await govUpgradeContract(proxy, desiredVersion);
  }
}

/**
 *
 * @param {} proxy
 * @param {string} desiredUpdateFee
 */
async function govSetFee(proxy, desiredUpdateFee) {
  const setFeePayload = new governance.SetFeeInstruction(
    governance.CHAINS[chainName],
    BigInt(desiredUpdateFee),
    BigInt(0)
  ).serialize();

  await createAndExecuteVaaFromPayloadThroughMultiSig(setFeePayload);

  const onchainUpdateFee = (await proxy.singleUpdateFeeInWei()).toString();
  assert(onchainUpdateFee == desiredUpdateFee);

  console.log(`✅ New update fee set successfully`);
}

async function syncUpdateFee(proxy) {
  const desiredUpdateFee = process.env.SINGLE_UPDATE_FEE_IN_WEI;
  const onchainUpdateFee = (await proxy.singleUpdateFeeInWei()).toString();

  if (onchainUpdateFee == desiredUpdateFee) {
    console.log(`✅ Contract update fee is in sync: ${desiredUpdateFee}`);
  } else {
    console.log(
      `❌ Update fee is not in sync. on-chain update fee: ${onchainUpdateFee}, desired update fee: ${desiredUpdateFee}. Updating...`
    );
    await govSetFee(proxy, desiredUpdateFee);
  }
}

module.exports = async function (callback) {
  try {
    const proxy = await PythUpgradable.deployed();
    console.log(`Syncing Pyth contract deployed on ${proxy.address}...`);

    await ensureThereIsNoOwner(proxy);
    await enesureWormholeAddrAndChainIdIsCorrect(proxy);

    await syncContractCode(proxy);
    await syncUpdateFee(proxy);
    // await syncValidTimePeriod(proxy);
    // await syncGovernanceDataSource(proxy);
    // await syncDataSources(proxy);

    callback();
  } catch (e) {
    callback(e);
  }
};
