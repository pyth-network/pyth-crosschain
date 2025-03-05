import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { EvmChain } from "../src/chains";
import { DefaultStore } from "../src/store";
import {
  DeploymentType,
  toDeploymentType,
  toPrivateKey,
  EvmPulseContract,
  PULSE_DEFAULT_PROVIDER,
  PULSE_DEFAULT_KEEPER,
} from "../src";
import {
  COMMON_DEPLOY_OPTIONS,
  deployIfNotCached,
  getWeb3Contract,
  getOrDeployWormholeContract,
  BaseDeployConfig,
  makeCacheFunction,
} from "./common";
import fs from "fs";
import path from "path";

interface DeploymentConfig extends BaseDeployConfig {
  type: DeploymentType;
  saveContract: boolean;
}

const CACHE_FILE = ".cache-deploy-evm-pulse-contracts";

const parser = yargs(hideBin(process.argv))
  .scriptName("deploy_evm_pulse_contracts.ts")
  .usage(
    "Usage: $0 --std-output-dir <path/to/std-output-dir/> --private-key <private-key> --chain <chain> --default-provider <default-provider> --wormhole-addr <wormhole-addr>"
  )
  .options({
    ...COMMON_DEPLOY_OPTIONS,
    chain: {
      type: "string",
      demandOption: true,
      desc: "Chain to upload the contract on. Can be one of the evm chains available in the store",
    },
  });

async function deployPulseContracts(
  chain: EvmChain,
  config: DeploymentConfig,
  executorAddr: string
): Promise<string> {
  console.log("Deploying PulseUpgradeable on", chain.getId(), "...");

  // Get the artifact and ensure bytecode is properly formatted
  const pulseArtifact = JSON.parse(
    fs.readFileSync(
      path.join(config.jsonOutputDir, "PulseUpgradeable.json"),
      "utf8"
    )
  );
  console.log("PulseArtifact bytecode type:", typeof pulseArtifact.bytecode);

  const pulseImplAddr = await deployIfNotCached(
    CACHE_FILE,
    chain,
    config,
    "PulseUpgradeable",
    []
  );

  console.log("PulseUpgradeable implementation deployed at:", pulseImplAddr);

  const pulseImplContract = getWeb3Contract(
    config.jsonOutputDir,
    "PulseUpgradeable",
    pulseImplAddr
  );

  console.log("Preparing initialization data...");

  const pulseInitData = pulseImplContract.methods
    .initialize(
      executorAddr, // owner
      executorAddr, // admin
      "1", // pythFeeInWei
      executorAddr, // pythAddress - using executor as a placeholder
      chain.isMainnet()
        ? PULSE_DEFAULT_PROVIDER.mainnet
        : PULSE_DEFAULT_PROVIDER.testnet,
      true, // prefillRequestStorage
      3600 // exclusivityPeriodSeconds - 1 hour
    )
    .encodeABI();

  console.log("Deploying ERC1967Proxy for Pulse...");

  // Custom deployment for ERC1967Proxy using the correct path
  const proxyArtifactPath = path.join(
    process.cwd(),
    "../target_chains/ethereum/contracts/artifacts/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol/ERC1967Proxy.json"
  );

  console.log("Loading proxy artifact from:", proxyArtifactPath);
  const proxyArtifact = JSON.parse(fs.readFileSync(proxyArtifactPath, "utf8"));

  // Handle bytecode which can be either a string or an object with an 'object' property
  let bytecode = proxyArtifact.bytecode;
  if (
    typeof bytecode === "object" &&
    bytecode !== null &&
    "object" in bytecode
  ) {
    bytecode = bytecode.object;
  }

  // Ensure bytecode starts with 0x
  if (!bytecode.startsWith("0x")) {
    bytecode = `0x${bytecode}`;
  }

  console.log("Proxy bytecode length:", bytecode.length);

  const cacheKey = `${chain.getId()}-ERC1967Proxy-PULSE`;
  const runIfNotCached = makeCacheFunction(CACHE_FILE);

  return await runIfNotCached(cacheKey, async () => {
    console.log(`Deploying ERC1967Proxy on ${chain.getId()}...`);
    const addr = await chain.deploy(
      config.privateKey,
      proxyArtifact.abi,
      bytecode,
      [pulseImplAddr, pulseInitData],
      config.gasMultiplier,
      config.gasPriceMultiplier
    );
    console.log(`✅ Deployed ERC1967Proxy on ${chain.getId()} at ${addr}`);
    return addr;
  });
}

async function topupAccountsIfNecessary(
  chain: EvmChain,
  deploymentConfig: DeploymentConfig
) {
  for (const [accountName, defaultAddresses] of [
    ["keeper", PULSE_DEFAULT_KEEPER],
    ["provider", PULSE_DEFAULT_PROVIDER],
  ] as const) {
    const accountAddress = chain.isMainnet()
      ? defaultAddresses.mainnet
      : defaultAddresses.testnet;
    const web3 = chain.getWeb3();
    const balance = Number(
      web3.utils.fromWei(await web3.eth.getBalance(accountAddress), "ether")
    );
    const MIN_BALANCE = 0.01;
    console.log(`${accountName} balance: ${balance} ETH`);
    if (balance < MIN_BALANCE) {
      console.log(
        `Balance is less than ${MIN_BALANCE}. Topping up the ${accountName} address...`
      );
      const signer = web3.eth.accounts.privateKeyToAccount(
        deploymentConfig.privateKey
      );
      web3.eth.accounts.wallet.add(signer);
      const estimatedGas = await web3.eth.estimateGas({
        from: signer.address,
        to: accountAddress,
        value: web3.utils.toWei(`${MIN_BALANCE}`, "ether"),
      });

      const tx = await web3.eth.sendTransaction({
        from: signer.address,
        to: accountAddress,
        gas: estimatedGas * deploymentConfig.gasMultiplier,
        value: web3.utils.toWei(`${MIN_BALANCE}`, "ether"),
      });

      console.log(
        `Topped up the ${accountName} address. Tx: `,
        tx.transactionHash
      );
    }
  }
}

async function main() {
  const argv = await parser.argv;

  const chainName = argv.chain;
  const chain = DefaultStore.chains[chainName];
  if (!chain) {
    throw new Error(`Chain ${chainName} not found`);
  } else if (!(chain instanceof EvmChain)) {
    throw new Error(`Chain ${chainName} is not an EVM chain`);
  }

  const deploymentConfig: DeploymentConfig = {
    type: toDeploymentType(argv.deploymentType),
    gasMultiplier: argv.gasMultiplier,
    gasPriceMultiplier: argv.gasPriceMultiplier,
    privateKey: toPrivateKey(argv.privateKey),
    jsonOutputDir: argv.stdOutputDir,
    saveContract: argv.saveContract,
  };

  const wormholeContract = await getOrDeployWormholeContract(
    chain,
    deploymentConfig,
    CACHE_FILE
  );

  await topupAccountsIfNecessary(chain, deploymentConfig);

  console.log(
    `Deployment config: ${JSON.stringify(deploymentConfig, null, 2)}\n`
  );

  console.log(`Deploying pulse contracts on ${chain.getId()}...`);

  const executorAddr = wormholeContract.address; // Using wormhole contract as executor for Pulse
  const pulseAddr = await deployPulseContracts(
    chain,
    deploymentConfig,
    executorAddr
  );

  if (deploymentConfig.saveContract) {
    console.log("Saving the contract in the store...");
    const contract = new EvmPulseContract(chain, pulseAddr);
    DefaultStore.pulse_contracts[contract.getId()] = contract;
    DefaultStore.saveAllContracts();
  }

  console.log(
    `✅ Deployed pulse contracts on ${chain.getId()} at ${pulseAddr}\n\n`
  );
}

main();
