const governance = require("@pythnetwork/xc-governance-sdk");
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
 * @param {string} payload
 * @returns {Promise<string>} VAA for the tx as hex (without leading 0x).
 */
async function createVaaFromPayload(payload) {
  const msVaaCachePath = `.${network}.ms_vaa_${payload}`;
  let vaa;
  if (fs.existsSync(msVaaCachePath)) {
    vaa = fs.readFileSync(msVaaCachePath).toString().trim();
    console.log(`VAA already exists: ${vaa}`);
    return vaa;
  } else {
    const msTxCachePath = `.${network}.ms_tx_${payload}`;

    let txKey;
    if (fs.existsSync(msTxCachePath)) {
      txKey = fs.readFileSync(msTxCachePath).toString();
    } else {
      console.log(
        `Creating multisig to send VAA with this payload: ${payload} ...`
      );
      txKey = await createMultisigTx(payload);
      fs.writeFileSync(msTxCachePath, txKey);
      throw new Error(
        "Contract not sync yet. Run the script again once the multisig transaction is ready to be executed."
      );
    }

    try {
      vaa = await executeMultisigTxAndGetVaa(txKey, payload);
    } catch (e) {
      console.error(e);
      throw new Error(
        "Could not execute multisig tx. If the transaction is executed please get the VAA manually " +
          `and put it on .${network}.ms_vaa_${payload}. Then execute the script again.`
      );
    }

    fs.writeFileSync(msVaaCachePath, vaa);
    fs.rmSync(`.${network}.ms_tx_${payload}`);
  }

  return vaa;
}

function cleanUpVaaCache(payload) {
  fs.rmSync(`.${network}.ms_vaa_${payload}`);
}

async function upgradeContract(proxy) {
  console.log("Upgrading the contract...");

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

  const vaa = await createVaaFromPayload(upgradePayloadHex);
  assertVaaPayloadEquals(vaa, upgradePayload);

  console.log(`Executing the VAA...`);

  await proxy.executeGovernanceInstruction("0x" + vaa);

  const newVersion = await proxy.version();
  const { version: targetVersion } = require("../package.json");
  assert(targetVersion == newVersion, "New contract version is not a match");

  fs.rmSync(implCachePath);
  cleanUpVaaCache(upgradePayloadHex);

  console.log(`Contract upgraded successfully`);
}

async function syncContractCode(proxy) {
  let deployedVersion = await proxy.version();
  const { version: targetVersion } = require("../package.json");

  if (deployedVersion === targetVersion) {
    console.log("Contract version up to date");
    return;
  } else {
    console.log(
      `Deployed version: ${deployedVersion}, target version: ${targetVersion}. On-chain contract is outdated.`
    );
    await upgradeContract(proxy);
  }
}

module.exports = async function (callback) {
  try {
    const proxy = await PythUpgradable.deployed();
    console.log(`Syncing Pyth contract deployed on ${proxy.address}...`);
    await syncContractCode(proxy);

    callback();
  } catch (e) {
    callback(e);
  }
};
