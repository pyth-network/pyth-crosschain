import { readFileSync, writeFileSync } from "fs";
import toml from "@ltd/j-toml";
import { exec } from "child_process";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

const argv = yargs(hideBin(process.argv))
  .usage("USAGE: npm run build-contract -- <command>")
  .option("cosmwasm", {
    type: "boolean",
  })
  .option("injective", {
    type: "boolean",
  })
  .option("osmosis", {
    type: "boolean",
  })
  .option("arm64", {
    type: "boolean",
  })
  .help()
  .alias("help", "h")
  .wrap(yargs.terminalWidth())
  .parseSync();

// we need to update the toml file to have a feature on - default=[feature (passed as parameter)]
// editing and writing the toml file before building the contract for other than cosmwasm
function cargoPreSetup(contractTomlFilePath: string, feature: string) {
  const originalTomlContentStr = readFileSync(contractTomlFilePath, "utf-8");
  const parsedToml = toml.parse(originalTomlContentStr);

  // add default feature to the cargo.toml
  // @ts-ignore
  parsedToml.features.default = [feature];

  // @ts-ignore
  const updatedToml = toml.stringify(parsedToml, {
    // don't remove this or else stringify will return an array of strings
    // where each string represents a line
    // this lets it combine all of those line
    newline: "\n",
    newlineAround: "section",
    forceInlineArraySpacing: 0,
  });

  writeFileSync(contractTomlFilePath, updatedToml);

  // after contract compilation we need to reset the original content of the toml file
  return function cargoPostCleanup() {
    writeFileSync(contractTomlFilePath, originalTomlContentStr);
  };
}

function build() {
  const contractTomlFilePath = "../contracts/pyth/Cargo.toml";

  let cleanup = () => {};
  if (argv.cosmwasm !== true) {
    const feature =
      argv.osmosis === true
        ? "osmosis"
        : argv.injective === true
          ? "injective"
          : undefined;

    if (feature === undefined) {
      console.log(
        "Please provide one of the options: ['cosmwasm', 'injective', 'osmosis']",
      );
      return;
    }

    cleanup = cargoPreSetup(contractTomlFilePath, feature);
  }

  const dockerImage =
    argv.arm64 === true
      ? "cosmwasm/workspace-optimizer-arm64:0.12.11"
      : "cosmwasm/workspace-optimizer:0.12.11";

  const buildCommand = `
          docker run --rm -v "$(cd ..; pwd)":/code \
          -v "$(cd ../../../pythnet; pwd)":/pythnet \
          -v "$(cd ../../../wormhole_attester; pwd)":/wormhole_attester \
          --mount type=volume,source="$(basename "$(cd ..; pwd)")_cache",target=/code/target \
          --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
          ${dockerImage}
          `;

  // build contract by running the command
  exec(buildCommand, (_error, stdout, stderr) => {
    console.log(stdout);
    console.log(stderr);

    cleanup();
  });
}

build();
