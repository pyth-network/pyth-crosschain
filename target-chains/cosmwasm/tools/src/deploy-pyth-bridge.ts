import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { Deployer, DeployerFactory } from "./deployer";
import { NETWORKS_OPTIONS } from "./network";
import { PythConfig } from "./pyth_config";

const argv = yargs(hideBin(process.argv))
  .option("network", {
    description: "Which network to deploy to",
    choices: NETWORKS_OPTIONS,
    required: true,
  })
  .option("artifact", {
    description: "Path to Pyth artifact",
    type: "string",
    required: false,
  })
  .option("mnemonic", {
    description: "Mnemonic (private key)",
    type: "string",
    required: true,
  })
  .option("instantiate", {
    description: "Instantiate contract if set (default: disabled)",
    type: "boolean",
    default: false,
    required: false,
  })
  .option("migrate", {
    description: "Migrate an existing contract if set (default: disabled)",
    type: "boolean",
    default: false,
    required: false,
  })
  .option("contract", {
    description: "Contract address, used only for migration",
    type: "string",
    required: false,
    default: "",
  })
  .option("code-id", {
    description:
      "Code Id, if provided this will be used for migrate/instantiate and no code will be uploaded",
    type: "number",
    requred: false,
  })
  .help()
  .alias("help", "h")
  .parseSync();

const {
  artifact,
  network,
  mnemonic,
  codeId: inputCodeId,
  instantiate,
  migrate,
  contract,
} = argv;
const pythConfig = PythConfig[network];
const deployer: Deployer = DeployerFactory.create(network, mnemonic);

// checks
if (inputCodeId === undefined && artifact === undefined)
  raiseCLError("Please provide either artifact or code id");

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function raiseCLError(message: string) {
  console.error(message);
  process.exit(1);
}

async function run() {
  let codeId: number;
  if (inputCodeId === undefined) {
    console.log("Deploying artifact");
    codeId = await deployer.deployArtifact(artifact!);
    console.log("Deployed Code ID: ", codeId);

    // sleep only when a new artifact is deployed
    if (instantiate || migrate) {
      console.log("Sleeping for 10 seconds for store transaction to finalize.");
      await sleep(10000);
    }
  } else codeId = inputCodeId;

  if (instantiate) {
    console.log("Instantiating a contract");
    const contractAddress = await deployer.instantiate(
      codeId,
      pythConfig,
      "pyth"
    );
    console.log(`Deployed Pyth contract at ${contractAddress}`);
  }
  if (migrate) {
    if (contract === "")
      raiseCLError(
        "Contract address is not provided. Provide it using --contract"
      );

    console.log(`Migrating contract ${contract} to ${codeId}`);
    await deployer.migrate(contract, codeId);
    console.log(
      `Contract ${contract} code_id successfully updated to ${codeId}`
    );
  }
}

run();
