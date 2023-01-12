import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Deployer, DeployerFactory } from "./deployer";
import { NETWORKS, NETWORKS_OPTIONS } from "./network";
import { CONFIG as PythConfig } from "./pyth_config";
import { CONFIG as NetworkConfig } from "./deployer/config";

const sharedOptions: { [key: string]: yargs.Options } = {
  network: {
    describe: "Which network to deploy to",
    choices: NETWORKS_OPTIONS,
    demandOption: true,
  },
  mnemonic: {
    type: "string",
    demandOption: true,
    describe: "Mnemonic (private key)",
  },
};

const argv = yargs(hideBin(process.argv))
  .usage("USAGE: npm run deploy-pyth -- <command>")
  .command(
    "deploy-artifact",
    "to deploy artifacts (.wasm files)",
    {
      artifact: {
        type: "string",
        demandOption: true,
        describe: "Path to contract artifact",
      },
      ...sharedOptions,
    },
    deployArtifactHandler
  )
  .example(
    'npm run deploy-pyth -- deploy-artifact --network osmosis_local --mnemonic "online prefer ..." --artifact "../artifacts/pyth_cosmwasm.wasm"',
    ""
  )
  .command(
    "instantiate",
    "to instantiate contract",
    {
      "code-id": {
        describe: "code-id requred to instantiate contract",
        type: "number",
        demandOption: true,
      },
      ...sharedOptions,
    },
    instantiateHandler
  )
  .example(
    'npm run deploy-pyth -- instantiate --network osmosis_local --code-id 10 --mnemonic "online prefer ..."',
    ""
  )
  .command(
    "migrate",
    "to migrate given contract",
    {
      "code-id": {
        describe: "code-id to which to migrate contract",
        type: "number",
        demandOption: true,
      },
      contract: {
        description: "contract address is required",
        type: "string",
        demandOption: true,
      },
      ...sharedOptions,
    },
    migrateHandler
  )
  .example(
    'npm run deploy-pyth -- migrate --network osmosis_local --code-id 9 --contract osmo1.. --mnemonic "online prefer ..."',
    ""
  )
  .command(
    "update-admin",
    "to update a contract's admin",
    {
      "new-admin": {
        description: "please input he new admin address",
        type: "string",
        demandOption: true,
      },
      contract: {
        description: "contract address is required",
        type: "string",
        demandOption: true,
      },
      ...sharedOptions,
    },
    updateAdminHandler
  )
  .example(
    'npm run deploy-pyth -- update-admin --network osmosis_local --new-admin osmo1.. --contract osmo1... --mnemonic "online prefer ..."',
    ""
  )
  .command(
    "get-contract-info",
    "get a contract info",
    {
      contract: {
        description: "contract address is required",
        type: "string",
        demandOption: true,
      },
      ...sharedOptions,
    },
    getContractInfoHandler
  )
  .example(
    'npm run deploy-pyth -- get-contract-info --network osmosis_local --contract osmo1... --mnemonic "online prefer ..."',
    ""
  )
  .demandCommand()
  .help()
  .alias("help", "h")
  .wrap(yargs.terminalWidth())
  .parse();

function getDeployer(network: NETWORKS, mnemonic: string): Deployer {
  const networkConfig = NetworkConfig[network];
  return DeployerFactory.create(networkConfig, mnemonic);
}

async function deployArtifactHandler(argv: any) {
  const { network, mnemonic, artifact } = argv;
  console.log("Deploying artifact");
  const codeId = await getDeployer(
    network as NETWORKS,
    mnemonic as string
  ).deployArtifact(artifact);
  console.log("Deployed Code ID: ", codeId);
}

async function instantiateHandler(argv: any) {
  const { network, mnemonic, codeId } = argv;
  const pythConfig = PythConfig[network as NETWORKS];
  console.log("Instantiating a contract");
  const contractAddress = await getDeployer(
    network as NETWORKS,
    mnemonic as string
  ).instantiate(codeId, pythConfig, "pyth");
  console.log(`Deployed Pyth contract at ${contractAddress}`);
}

async function migrateHandler(argv: any) {
  const { network, mnemonic, codeId, contract } = argv;

  console.log(`Migrating contract ${contract} to ${codeId}`);
  await getDeployer(network as NETWORKS, mnemonic as string).migrate(
    contract,
    codeId
  );
  console.log(`Contract ${contract} code_id successfully updated to ${codeId}`);
}

async function updateAdminHandler(argv: any) {
  const { network, mnemonic, newAdmin, contract } = argv;
  console.log("Updating contract's admin");
  const deployer = getDeployer(network as NETWORKS, mnemonic as string);
  await deployer.updateAdmin(newAdmin, contract);
  const info = await deployer.getContractInfo(contract);
  console.log(info);
  console.log("Contract's admin successfully updates");
}

async function getContractInfoHandler(argv: any) {
  const { network, mnemonic, contract } = argv;

  console.log(`Fetching contract info for: ${contract}`);
  const info = await getDeployer(
    network as NETWORKS,
    mnemonic as string
  ).getContractInfo(contract);
  console.log(`Fetched contract info for: ${contract}`);
  console.log(info);
}
