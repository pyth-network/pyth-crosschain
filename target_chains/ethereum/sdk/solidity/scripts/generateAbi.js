const fs = require("fs");
const solc = require("solc");

// Assuming each contract is in the file with the same name.
var contracts = ["IPyth", "IPythEvents", "AbstractPyth", "MockPyth"];

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
