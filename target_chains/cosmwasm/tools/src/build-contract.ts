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
  .help()
  .alias("help", "h")
  .wrap(yargs.terminalWidth())
  .parseSync();

// we need to update the toml file to have a feature on - default=['injective']
// editing and writing the toml file before building the contract for injective
function injectivePreSetup(contractTomlFilePath: string) {
  const originalTomlContentStr = readFileSync(contractTomlFilePath, "utf-8");
  const parsedToml = toml.parse(originalTomlContentStr);

  // add injective feature to the cargo.toml
  // @ts-ignore
  parsedToml.features.default = ["injective"];

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
  return function injectivePostCleanup() {
    writeFileSync(contractTomlFilePath, originalTomlContentStr);
  };
}

function build() {
  if (argv.cosmwasm !== true && argv.injective !== true) {
    console.log("Please provide one of the options: ['cosmwasm', 'injective']");
    return;
  }

  const contractTomlFilePath = "../contracts/pyth/Cargo.toml";

  let cleanup = () => {};
  if (argv.injective === true)
    cleanup = injectivePreSetup(contractTomlFilePath);

  const buildCommand = `
          docker run --rm -v "$(cd ..; pwd)":/code \
          -v $(cd ../../../wormhole_attester; pwd):/wormhole_attester \
          --mount type=volume,source="$(basename "$(cd ..; pwd)")_cache",target=/code/target \
          --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
          cosmwasm/workspace-optimizer:0.12.11
          `;

  // build contract by running the command
  exec(buildCommand, (_error, stdout, stderr) => {
    console.log(stdout);
    console.log(stderr);

    cleanup();
  });
}

build();
