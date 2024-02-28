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
    },
  };

  function findImports(path) {
    return {
      contents: fs.readFileSync(path).toString(),
    };
  }

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports })
  );

  if (!fs.existsSync("abis")) {
    fs.mkdirSync("abis");
  }

  for (let contract of contracts) {
    const contractFile = `${contract}.sol`;

    const abi = output.contracts[contractFile][contract].abi;
    fs.writeFileSync(
      `abis/${contract}.json`,
      JSON.stringify(abi, null, 2) + "\n"
    );
  }
}

module.exports = { generateAbi };
