import { LCDClient, MnemonicKey } from "@terra-money/terra.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { TerraDeployer } from "./terra";
import { InjectiveDeployer } from "./injective";
import { Network } from "@injectivelabs/networks";
import { PrivateKey } from "@injectivelabs/sdk-ts";

const argv = yargs(hideBin(process.argv))
  .option("network", {
    description: "Which network to deploy to",
    choices: ["mainnet", "testnet"],
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

const artifact = argv.artifact!;

const CONFIG = {
  terra_mainnet: {
    type: "terra",
    terraHost: {
      URL: "https://phoenix-lcd.terra.dev",
      chainID: "phoenix-1",
      name: "mainnet",
    },
    pyth_config: {
      wormhole_contract:
        "terra12mrnzvhx3rpej6843uge2yyfppfyd3u9c3uq223q8sl48huz9juqffcnh",
      data_sources: [
        {
          emitter: Buffer.from(
            "6bb14509a612f01fbbc4cffeebd4bbfb492a86df717ebe92eb6df432a3f00a25",
            "hex"
          ).toString("base64"),
          chain_id: 1,
        },
        {
          emitter: Buffer.from(
            "f8cd23c2ab91237730770bbea08d61005cdda0984348f3f6eecb559638c0bba0",
            "hex"
          ).toString("base64"),
          chain_id: 26,
        },
      ],
      governance_source: {
        emitter: Buffer.from(
          "5635979a221c34931e32620b9293a463065555ea71fe97cd6237ade875b12e9e",
          "hex"
        ).toString("base64"),
        chain_id: 1,
      },
      governance_source_index: 0,
      governance_sequence_number: 0,
      chain_id: 18,
      valid_time_period_secs: 60,
      fee: {
        amount: "1",
        denom: "uluna",
      },
    },
  },
  terra_testnet: {
    type: "terra",
    terraHost: {
      URL: "https://pisco-lcd.terra.dev",
      chainID: "pisco-1",
      name: "testnet",
    },
    pyth_config: {
      wormhole_contract:
        "terra19nv3xr5lrmmr7egvrk2kqgw4kcn43xrtd5g0mpgwwvhetusk4k7s66jyv0",
      data_sources: [
        {
          emitter: Buffer.from(
            "f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0",
            "hex"
          ).toString("base64"),
          chain_id: 1,
        },
        {
          emitter: Buffer.from(
            "a27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6",
            "hex"
          ).toString("base64"),
          chain_id: 26,
        },
      ],
      governance_source: {
        emitter: Buffer.from(
          "63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385",
          "hex"
        ).toString("base64"),
        chain_id: 1,
      },
      governance_source_index: 0,
      governance_sequence_number: 0,
      chain_id: 18,
      valid_time_period_secs: 60,
      fee: {
        amount: "1",
        denom: "uluna",
      },
    },
  },
  injective_testnet: {
    type: "injective",
    injectiveHost: {
      network: Network.Testnet,
    },
    pythConfig: {
      wormhole_contract: "inj1xx3aupmgv3ce537c0yce8zzd3sz567syuyedpg",
      data_sources: [
        {
          emitter: Buffer.from(
            "f346195ac02f37d60d4db8ffa6ef74cb1be3550047543a4a9ee9acf4d78697b0",
            "hex"
          ).toString("base64"),
          chain_id: 1,
        },
        {
          emitter: Buffer.from(
            "a27839d641b07743c0cb5f68c51f8cd31d2c0762bec00dc6fcd25433ef1ab5b6",
            "hex"
          ).toString("base64"),
          chain_id: 26,
        },
      ],
      governance_source: {
        emitter: Buffer.from(
          "63278d271099bfd491951b3e648f08b1c71631e4a53674ad43e8f9f98068c385",
          "hex"
        ).toString("base64"),
        chain_id: 1,
      },
      governance_source_index: 0,
      governance_sequence_number: 0,
      chain_id: 19,
      valid_time_period_secs: 60,
      fee: {
        amount: "1",
        // FIXME ??
        denom: "inj",
      },
    },
  },
};

// @ts-ignore
var pythConfig = CONFIG[argv.network].pyth_config;
// @ts-ignore
var deployer: Deployer;

// @ts-ignore
const config: any = CONFIG[argv.network];
if (config.type == "terra") {
  const lcd = new LCDClient(config.terraHost);
  const wallet = lcd.wallet(
    new MnemonicKey({
      mnemonic: argv.mnemonic,
    })
  );
  deployer = new TerraDeployer(wallet);
} else if (config.type == "injective") {
  deployer = new InjectiveDeployer(
    config.injectiveHost.network,
    PrivateKey.fromMnemonic(argv.mnemonic)
  );
}

/* Deploy artifacts */

var codeId: number;

if (argv.codeId !== undefined) {
  codeId = argv.codeId;
} else {
  if (argv.artifact === undefined) {
    console.error(
      "Artifact is not provided. Please at least provide artifact or code id"
    );
    process.exit(1);
  }

  codeId = await deployer.deployArtifact(artifact);
  console.log("Code ID: ", codeId);

  if (argv.instantiate || argv.migrate) {
    console.log("Sleeping for 10 seconds for store transaction to finalize.");
    await sleep(10000);
  }
}

if (argv.instantiate) {
  console.log("Instantiating a contract");
  const contractAddress = await deployer.instantiate(
    codeId,
    pythConfig,
    "pyth"
  );
  console.log(`Deployed Pyth contract at ${contractAddress}`);
}

if (argv.migrate) {
  if (argv.contract === "") {
    console.error(
      "Contract address is not provided. Provide it using --contract"
    );
    process.exit(1);
  }

  console.log(`Migrating contract ${argv.contract} to ${codeId}`);

  const resultCodeId = deployer.migrate(argv.contract, codeId);

  console.log(
    `Contract ${argv.contract} code_id successfully updated to ${resultCodeId}`
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
