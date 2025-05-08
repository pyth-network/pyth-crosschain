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
    try {
      if (path.startsWith('@pythnetwork/pyth-sdk-solidity/')) {
        const sdkPath = path.replace('@pythnetwork/pyth-sdk-solidity/', '../../../sdk/solidity/');
        return {
          contents: fs.readFileSync(sdkPath).toString(),
        };
      } else if (path.startsWith('@pythnetwork/')) {
        const nodeModulesPath = path.replace('@pythnetwork/', '../../../node_modules/@pythnetwork/');
        try {
          return {
            contents: fs.readFileSync(nodeModulesPath).toString(),
          };
        } catch (innerError) {
          const localPath = path.replace('@pythnetwork/', '../');
          return {
            contents: fs.readFileSync(localPath).toString(),
          };
        }
      }
      return {
        contents: fs.readFileSync(path).toString(),
      };
    } catch (error) {
      console.error(`Error importing ${path}: ${error.message}`);
      return { error: `Error importing ${path}: ${error.message}` };
    }
  }

  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: findImports }),
  );

  if (!fs.existsSync("abis")) {
    fs.mkdirSync("abis");
  }

  for (let contract of contracts) {
    const contractFile = `${contract}.sol`;

    const abi = output.contracts[contractFile][contract].abi;
    fs.writeFileSync(
      `abis/${contract}.json`,
      JSON.stringify(abi, null, 2) + "\n",
    );
  }
}

module.exports = { generateAbi };
