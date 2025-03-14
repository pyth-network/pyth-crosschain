// Deploy Wormhole and Pyth contract to Tilt. If you want to
// test the contracts locally you need to build the wormhole contract
// as well. You can use Dockerfile.cosmwasm in the root of this repo
// to do that.

import { readdirSync } from "fs";
import { DeployerFactory } from "./deployer";
import { CONFIG as NetworkConfig } from "./deployer/config";
import { NETWORKS } from "./network";

const ARTIFACT_DIR = "../artifacts/";

async function deploy() {
  /*
  NOTE: Only append to this array: keeping the ordering is crucial, as the
  contracts must be imported in a deterministic order so their addresses remain
  deterministic.
*/
  const artifacts = ["wormhole.wasm", "pyth_cosmwasm.wasm"];

  /* Check that the artifact folder contains all the wasm files we expect and nothing else */

  const actual_artifacts = readdirSync("../artifacts/").filter((a) =>
    a.endsWith(".wasm"),
  );

  const missing_artifacts = artifacts.filter(
    (a) => !actual_artifacts.includes(a),
  );
  if (missing_artifacts.length) {
    console.log(
      "Error during terra deployment. The following files are expected to be in the artifacts folder:",
    );
    missing_artifacts.forEach((file) => console.log(`  - ${file}`));
    console.log(
      "Hint: the deploy script needs to run after the contracts have been built.",
    );
    console.log(
      "External binary blobs need to be manually added in tools/Dockerfile.",
    );
    process.exit(1);
  }

  const unexpected_artifacts = actual_artifacts.filter(
    (a) => !artifacts.includes(a),
  );
  if (unexpected_artifacts.length) {
    console.log(
      "Error during terra deployment. The following files are not expected to be in the artifacts folder:",
    );
    unexpected_artifacts.forEach((file) => console.log(`  - ${file}`));
    console.log("Hint: you might need to modify tools/deploy.js");
    process.exit(1);
  }

  /* Set up terra deployer */
  const deployer = DeployerFactory.create(
    NetworkConfig[NETWORKS.TERRA_LOCAL],
    "notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius",
  );

  /* Deploy artifacts */
  const codeIds: Record<string, number> = {};
  for (const file of artifacts) {
    const codeId = await deployer.deployArtifact(`../artifacts/${file}`);
    codeIds[file] = codeId;
  }
  console.log(codeIds);

  /* Instantiate contracts.
   *
   * We instantiate the core contracts here (i.e. wormhole itself and the bridge contracts).
   * The wrapped asset contracts don't need to be instantiated here, because those
   * will be instantiated by the on-chain bridge contracts on demand.
   * */

  // Instantiate contracts.  NOTE: Only append at the end, the ordering must be
  // deterministic for the addresses to work

  const addresses: Record<string, string> = {};

  let contract = "wormhole.wasm";

  // Governance constants defined by the Wormhole spec.
  const govChain = 1;
  const govAddress =
    "0000000000000000000000000000000000000000000000000000000000000004";

  let inst_msg: Object = {
    gov_chain: govChain,
    gov_address: Buffer.from(govAddress, "hex").toString("base64"),
    guardian_set_expirity: 86400,
    initial_guardian_set: {
      addresses: [
        {
          bytes: Buffer.from(
            "beFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe",
            "hex",
          ).toString("base64"),
        },
      ],
      expiration_time: 0,
    },
    chain_id: 18,
    fee_denom: "uluna",
  };
  console.log("Instantiating Wormhole contract");
  addresses[contract] = await deployer.instantiate(
    codeIds[contract],
    inst_msg,
    "wormhole",
  );

  contract = "pyth_cosmwasm.wasm";

  const pythEmitterAddress =
    "71f8dcb863d176e2c420ad6610cf687359612b6fb392e0642b0ca6b1f186aa3b";
  const pythGovernanceEmitterAddress =
    "0000000000000000000000000000000000000000000000000000000000001234";
  const pythChain = 1;

  inst_msg = {
    wormhole_contract: addresses["wormhole.wasm"],
    data_sources: [
      {
        emitter: Buffer.from(pythEmitterAddress, "hex").toString("base64"),
        chain_id: pythChain,
      },
    ],
    governance_source: {
      emitter: Buffer.from(pythGovernanceEmitterAddress, "hex").toString(
        "base64",
      ),
      chain_id: pythChain,
    },
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: 3,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: "uluna",
    },
  };

  console.log("Instantiating Pyth contract");
  addresses[contract] = await deployer.instantiate(
    codeIds[contract],
    inst_msg,
    "pyth",
  );
}

deploy();
