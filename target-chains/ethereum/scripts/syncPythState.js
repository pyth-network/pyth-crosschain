/**
 * This is a truffle script that syncs the on-chain contract with
 * the reference implementation and state in this repo. Please execute
 * this script using `deploy.sh` as described in `Deploying.md` file.
 *
 * This script is a statefull and fully automated. It will invoke the multisig
 * cli in the `../../governance/multisig-wh-message-builder`
 * to create governed instructions to change on-chain contracts.
 * As multisig instructions require multiple people approval, this script
 * will create some cache files to store the last step and continues from
 * the previous step in the next run.
 */

const governance = require("@pythnetwork/xc-governance-sdk");
const wormhole = require("@certusone/wormhole-sdk");
const assertVaaPayloadEquals = require("./assertVaaPayloadEquals");
const { assert } = require("chai");
const util = require("node:util");
const exec = util.promisify(require("node:child_process").exec);
const fs = require("fs");
const lodash = require("lodash");

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
    cwd: "../../governance/multisig-wh-message-builder",
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
 * @param {} proxy
 * @param {Buffer} payload
 * @param {boolean|undefined} keepVaaCache
 * @returns {Promise<void>}
 */
async function createAndExecuteVaaFromPayloadThroughMultiSig(
  proxy,
  payload,
  keepVaaCache
) {
  const vaa = await createVaaFromPayloadThroughMultiSig(payload);

  assertVaaPayloadEquals(vaa, payload);

  console.log(`Executing the VAA...`);
  await proxy.executeGovernanceInstruction("0x" + vaa);

  if (keepVaaCache !== true) {
    cleanUpVaaCache(payload);
  }
}

async function ensureWormholeAddrAndChainIdIsCorrect(proxy) {
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
async function upgradeContract(proxy, desiredVersion) {
  const implCachePath = `.${network}.new_impl`;
  let newImplementationAddress;
  if (fs.existsSync(implCachePath)) {
    newImplementationAddress = fs.readFileSync(implCachePath).toString();
    console.log(
      `A new implementation has already been deployed at address ${newImplementationAddress}`
    );
  } else {
    console.log("Deploying a new implementation...");

    let newImplementation;
    try {
      newImplementation = await PythUpgradable.new();
    } catch (e) {
      console.error(
        "Could not deploy the new contract. Please try again. If this is a zkSync " +
          "network truffle cannot it and you need to deploy it manually (as described in Deploying.md) "`and store the address on ${implCachePath} file. Then rerun the script.`
      );
      throw e;
    }

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

  await createAndExecuteVaaFromPayloadThroughMultiSig(proxy, upgradePayload);

  fs.rmSync(implCachePath);
  cleanUpVaaCache(upgradePayloadHex);

  const newVersion = await proxy.version();
  assert(desiredVersion == newVersion, "New contract version is not a match");

  console.log(`✅ Upgraded the contract successfully.`);
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
    await upgradeContract(proxy, desiredVersion);
  }
}

async function syncUpdateFee(proxy) {
  const desiredUpdateFee = process.env.SINGLE_UPDATE_FEE_IN_WEI;
  const onchainUpdateFee = (await proxy.singleUpdateFeeInWei()).toString();

  if (onchainUpdateFee == desiredUpdateFee) {
    console.log(`✅ Contract update fee is in sync: ${desiredUpdateFee}`);
  } else {
    console.log(
      `❌ Update fee is not in sync. on-chain update fee: ${onchainUpdateFee}, ` +
        `desired update fee: ${desiredUpdateFee}. Updating...`
    );

    const setFeePayload = new governance.SetFeeInstruction(
      governance.CHAINS[chainName],
      BigInt(desiredUpdateFee),
      BigInt(0)
    ).serialize();

    await createAndExecuteVaaFromPayloadThroughMultiSig(proxy, setFeePayload);

    const newOnchainUpdateFee = (await proxy.singleUpdateFeeInWei()).toString();
    assert(newOnchainUpdateFee == desiredUpdateFee);

    console.log(`✅ Set the new update fee successfully.`);
  }
}

async function syncValidTimePeriod(proxy) {
  const desiredValidTimePeriod = process.env.VALID_TIME_PERIOD_SECONDS;
  const onchainValidTimePeriod = (
    await proxy.validTimePeriodSeconds()
  ).toString();

  if (onchainValidTimePeriod == desiredValidTimePeriod) {
    console.log(
      `✅ Contract valid time period is in sync: ${desiredValidTimePeriod}s`
    );
  } else {
    console.log(
      `❌ Valid time period is not in sync. on-chain valid time period: ${onchainValidTimePeriod}s, ` +
        `desired valid time period: ${desiredValidTimePeriod}s. Updating...`
    );

    const setValidPeriodPayload = new governance.SetValidPeriodInstruction(
      governance.CHAINS[chainName],
      BigInt(desiredValidTimePeriod)
    ).serialize();

    await createAndExecuteVaaFromPayloadThroughMultiSig(
      proxy,
      setValidPeriodPayload
    );

    const newOnchainValidTimePeriod = (
      await proxy.validTimePeriodSeconds()
    ).toString();
    assert(newOnchainValidTimePeriod == desiredValidTimePeriod);

    console.log(`✅ Set the new valid time period successfully.`);
  }
}

async function syncDataSources(proxy) {
  const desiredDataSources = new Set([
    [
      Number(process.env.SOLANA_CHAIN_ID).toString(),
      process.env.SOLANA_EMITTER,
    ],
    [
      Number(process.env.PYTHNET_CHAIN_ID).toString(),
      process.env.PYTHNET_EMITTER,
    ],
  ]);

  const onchainDataSources = new Set(await proxy.validDataSources());

  if (lodash.isEqual(desiredDataSources, onchainDataSources)) {
    console.log(
      `✅ Contract data sources are in sync:\n` +
        `${JSON.stringify([...desiredDataSources])}`
    );
  } else {
    console.log(
      `❌ Data sources are not in sync. on-chain data sources:\n` +
        `${JSON.stringify([...onchainDataSources])}\n` +
        `desired data sources:\n` +
        `${JSON.stringify([...desiredDataSources])}\n` +
        `Updating...`
    );

    // Usually this change is universal, so the Payload is generated for all
    // the chains.
    const setDataSourcesPayload = new governance.SetDataSourcesInstruction(
      governance.CHAINS[chainName],
      Array.from(desiredDataSources).map(
        (ds) =>
          new governance.DataSource(
            Number(ds[0]),
            new governance.HexString32Bytes(ds[1])
          )
      )
    ).serialize();
    await createAndExecuteVaaFromPayloadThroughMultiSig(
      proxy,
      setDataSourcesPayload
    );

    const newOnchainDataSources = new Set(await proxy.validDataSources());
    assert(lodash.isEqual(desiredDataSources, newOnchainDataSources));

    console.log(`✅ Set the new data sources successfully.`);
  }
}

async function syncGovernanceDataSource(proxy) {
  const desiredGovDataSource = [
    Number(process.env.GOVERNANCE_CHAIN_ID).toString(),
    process.env.GOVERNANCE_EMITTER,
  ];

  const onchainGovDataSource = Array.from(await proxy.governanceDataSource());

  if (lodash.isEqual(desiredGovDataSource, onchainGovDataSource)) {
    console.log(
      `✅ Contract data sources are in sync:\n` + `${desiredGovDataSource}`
    );
  } else {
    console.log(
      `❌ Governance data source is not in sync. on-chain governance data source:\n` +
        `${onchainGovDataSource}\n` +
        `desired governance data source:\n` +
        `${desiredGovDataSource}\n` +
        `Cannot upgrade governance data source automatically. Please upgrade it manually`
    );
    throw new Error("Governance data source is not in sync.");
  }
}

module.exports = async function (callback) {
  try {
    const proxy = await PythUpgradable.deployed();
    console.log(`Syncing Pyth contract deployed on ${proxy.address}...`);

    await ensureThereIsNoOwner(proxy);
    await ensureWormholeAddrAndChainIdIsCorrect(proxy);

    await syncContractCode(proxy);
    await syncUpdateFee(proxy);
    await syncValidTimePeriod(proxy);
    await syncDataSources(proxy);
    await syncGovernanceDataSource(proxy);

    callback();
  } catch (e) {
    callback(e);
  }
};
