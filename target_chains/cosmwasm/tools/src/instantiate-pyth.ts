import {
  ChainIdTestnet,
  ChainIdsTestnet,
  createExecutorForChain,
} from "./chains-manager/chains";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readFileSync } from "fs";
import {
  InstantiateContractResponse,
  StoreCodeResponse,
} from "./chains-manager/chain-executor";
import { Pipeline } from "./pipeline";
import { rimrafSync } from "rimraf";
import { CHAINS } from "@pythnetwork/xc-governance-sdk";
import download from "download";
import AdmZip from "adm-zip";
import path from "path";

const argv = yargs(hideBin(process.argv))
  .usage("USAGE: npm run wormhole-stub -- <command>")
  .option("mnemonic", {
    type: "string",
    demandOption: "Please provide the mnemonic",
  })
  .option("contract-version", {
    type: "string",
    demandOption: `Please input the contract-version of the pyth contract.`,
  })
  .option("chain-id", {
    type: "string",
    choices: ChainIdsTestnet,
  })
  .option("mainnet", {
    type: "boolean",
    desc: "Execute this script for mainnet networks. THIS WILL BE ADDED IN FUTURE",
  })
  .help()
  .alias("help", "h")
  .wrap(yargs.terminalWidth())
  .parseSync();

// IMPORTANT: IN ORDER TO RUN THIS SCRIPT FOR CHAINS
// WE NEED SOME METADATA
// HERE IS WHERE WE WILL BE ADDING THAT

// The type definition here make sure that the chain is added to xc_governance_sdk_js before this script was executed
type PythConfig = Record<
  ChainIdTestnet,
  {
    feeDenom: string;
    chainId: number;
    wormholeContract: string;
    // default name used will be cosmwasm
    artifactsZipFileName?: string;
  }
>;
const pythConfig: PythConfig = {
  [ChainIdTestnet.INJECTIVE]: {
    feeDenom: "inj",
    chainId: CHAINS.injective,
    wormholeContract: "inj1ks8v2tvx2vsqxx7sgckl9h7rxga60tuvgezpps",
    artifactsZipFileName: "injective",
  },
  [ChainIdTestnet.OSMOSIS_4]: {
    feeDenom: "uosmo",
    chainId: CHAINS.osmosis,
    wormholeContract:
      "osmo18njur8dzzq6lm5dd6n2td94jgmnywt0j9es2ymxpa0zyy7jrwwuq4v8arc",
    artifactsZipFileName: "osmosis",
  },
  [ChainIdTestnet.OSMOSIS_5]: {
    feeDenom: "uosmo",
    chainId: CHAINS.osmosis,
    wormholeContract:
      "osmo1224ksv5ckfcuz2geeqfpdu2u3uf706y5fx8frtgz6egmgy0hkxxqtgad95",
    artifactsZipFileName: "osmosis",
  },
  [ChainIdTestnet.SEI_ATLANTIC_2]: {
    feeDenom: "usei",
    chainId: CHAINS.sei,
    wormholeContract:
      "sei1tu7w5lxsckpa4ahd4umra0k02zyd7eq79j7zxk8e3ds8evlejywqrtsl6a",
  },
  [ChainIdTestnet.NEUTRON_PION_1]: {
    feeDenom: "untrn",
    chainId: CHAINS.neutron,
    wormholeContract:
      "neutron17xlvf3f82tklvzpveam56n96520pdrxfgpralyhf3nq7f33uvgzqrgegc7",
  },
};

async function run() {
  const STORAGE_DIR = "./testnet/instantiate-pyth";

  // download wasm code from github
  let contractBytesDict = await getContractBytesDict(
    Object.values(pythConfig).map(({ artifactsZipFileName }) =>
      artifactsZipFileName ? artifactsZipFileName : "cosmwasm"
    ),
    argv.contractVersion
  );

  let chainIds = argv.chainId === undefined ? ChainIdsTestnet : [argv.chainId];
  for (let chainId of chainIds) {
    let pipelineStoreFilePath = `${STORAGE_DIR}/${chainId}-${argv.contractVersion}.json`;
    const pipeline = new Pipeline(chainId, pipelineStoreFilePath);

    const chainExecutor = createExecutorForChain(chainId, argv.mnemonic);

    // add stages
    // 1 deploy artifact
    pipeline.addStage({
      id: "deploy-pyth-code",
      executor: async () => {
        return chainExecutor.storeCode({
          contractBytes:
            contractBytesDict[
              pythConfig[chainId].artifactsZipFileName ?? "cosmwasm"
            ],
        });
      },
    });

    // 2 instantiate contract
    pipeline.addStage({
      id: "instantiate-contract",
      executor: (getResultOfPastStage) => {
        const storeCodeRes: StoreCodeResponse =
          getResultOfPastStage("deploy-pyth-code");

        return chainExecutor.instantiateContract({
          codeId: storeCodeRes.codeId,
          instMsg: getPythConfig(pythConfig[chainId]),
          label: "wormhole",
        });
      },
    });

    // 3 set its own admin
    pipeline.addStage({
      id: "set-own-admin",
      executor: (getResultOfPastStage) => {
        const instantiateContractRes: InstantiateContractResponse =
          getResultOfPastStage("instantiate-contract");

        return chainExecutor.updateContractAdmin({
          newAdminAddr: instantiateContractRes.contractAddr,
          contractAddr: instantiateContractRes.contractAddr,
        });
      },
    });

    await pipeline.run();
  }
}

function getPythConfig({
  feeDenom,
  wormholeContract,
  chainId,
}: {
  feeDenom: string;
  wormholeContract: string;
  chainId: number;
}) {
  return {
    wormhole_contract: wormholeContract,
    governance_source_index: 0,
    governance_sequence_number: 0,
    chain_id: chainId,
    valid_time_period_secs: 60,
    fee: {
      amount: "1",
      denom: feeDenom,
    },
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
  };
}

async function getContractBytesDict(
  artifactZipFileNames: string[],
  version: string
) {
  const githubArtifactsLink = `https://github.com/pyth-network/pyth-crosschain/releases/download/pyth-cosmwasm-contract-v${version}/`;
  const tmpCodeStorageDir = "./tmp";
  // clear tmp directory before downloading contracts
  rimrafSync(tmpCodeStorageDir);

  const uniqueArtifactsZipName = Array.from(new Set(artifactZipFileNames));

  // download zip files
  await Promise.all(
    uniqueArtifactsZipName.map(async (artifactZipName) => {
      await download(
        githubArtifactsLink + artifactZipName + ".zip",
        tmpCodeStorageDir
      );
    })
  );

  // extract zip files
  uniqueArtifactsZipName.map(async (artifactZipName) => {
    const zip = new AdmZip(
      path.resolve(tmpCodeStorageDir + "/" + artifactZipName + ".zip")
    );
    zip.extractAllTo(path.resolve(tmpCodeStorageDir));
  });

  let contractBytesDict: { [fileName: string]: Buffer } = {};
  for (let uniqueArtifactZipName of uniqueArtifactsZipName) {
    const contractBytes = readFileSync(
      tmpCodeStorageDir + "/" + uniqueArtifactZipName + "/pyth_cosmwasm.wasm"
    );
    contractBytesDict[uniqueArtifactZipName] = contractBytes;
  }

  // clear tmp directory before downloading contracts
  rimrafSync(tmpCodeStorageDir);

  return contractBytesDict;
}

run();
