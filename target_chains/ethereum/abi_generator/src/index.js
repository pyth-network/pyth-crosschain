const fs = require("fs");
const solc = require("solc");

/**
 * Generate ABI files for the given contracts and save them in the `abis` directory.
 * Creates the `abis` directory if it does not exist.
 *
 * @param contracts List of file names assuming each contract is in the file with the same name.
 */
function generateAbi(contracts) {
  var sources = {};
  var outputSelection = {};

  for (let contract of contracts) {
    const contractFile = `${contract}.sol`;
    sources[contractFile] = {
      content: fs.readFileSync(contractFile).toString(),
    };
    outputSelection[contractFile] = {};
    outputSelection[contractFile][contract] = ["abi"];
  }

  var input = {
    language: "Solidity",
    sources,
    settings: {
      outputSelection,
      remappings: [
        // Needed for @pythnetwork/pulse-sdk-solidity since it depends on @pythnetwork/pyth-sdk-solidity
        "@pythnetwork/=./node_modules/@pythnetwork/",
      ],
    },
  };

  function findImports(path) {
    return {
      contents: fs.readFileSync(path).toString(),
    };
  }

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports }),
  );

  if (!fs.existsSync("abis")) {
    fs.mkdirSync("abis");
  }

  // Report compilation failures
  if (output.errors) {
    // We can still generate ABIs with warnings, only throw for errors
    const errors = output.errors.filter((e) => e.severity === "error");
    if (errors.length > 0) {
      console.error("Compilation errors:");
      for (const error of errors) {
        console.error(error.formattedMessage || error.message);
      }
      throw new Error("Compilation failed due to errors");
    }
  }

  for (let contract of contracts) {
    const contractFile = `${contract}.sol`;

    if (!output.contracts[contractFile]) {
      throw new Error(`Unable to produce ABI for ${contractFile}.`);
    }
    if (!output.contracts[contractFile][contract]) {
      throw new Error(`Unable to produce ABI for ${contractFile}:${contract}.`);
    }
    const abi = output.contracts[contractFile][contract].abi;
    fs.writeFileSync(
      `abis/${contract}.json`,
      JSON.stringify(abi, null, 2) + "\n",
    );
  }
}

module.exports = { generateAbi };
