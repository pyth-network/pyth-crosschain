import { readFileSync, existsSync, mkdirSync } from "fs";
import { rimrafSync } from "rimraf";
import AdmZip from "adm-zip";
import path from "path";
import { DownloaderHelper } from "node-downloader-helper";

// We have released the compile contacts on github. If a chain needs some specific
// feature in a contract, a version of the contract with that specific features is
// also released. For example, "injective.zip" for injective.
// Given a contract version (eg 1.2.0) and  zipFileNames (eg ["injective", "osmosis"])
// this method will return an object with key = zipFileName and value = compiledCode
export async function getContractBytesDict(
  artifactZipFileNames: string[],
  version: string
) {
  const githubArtifactsLink = `https://github.com/pyth-network/pyth-crosschain/releases/download/pyth-cosmwasm-contract-v${version}/`;
  const tmpCodeStorageDir = "./tmp";
  // clear tmp directory before downloading contracts
  rimrafSync(tmpCodeStorageDir);

  if (existsSync(tmpCodeStorageDir) === false) {
    mkdirSync(tmpCodeStorageDir, { recursive: true });
  }

  const uniqueArtifactsZipName = Array.from(new Set(artifactZipFileNames));

  // download zip files
  await Promise.all(
    uniqueArtifactsZipName.map(async (artifactZipName) => {
      return new Promise<void>((resolve, reject) => {
        const dl = new DownloaderHelper(
          githubArtifactsLink + artifactZipName + ".zip",
          tmpCodeStorageDir
        );

        dl.on("end", () => {
          console.log("Download Completed");
          resolve();
        });
        dl.on("error", (err) => {
          console.log("Download Failed", err);
          reject(err);
        });
        dl.start().catch((err) => {
          console.error(err);
          reject(err);
        });
      });
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

  // clear tmp directory after downloading contracts
  rimrafSync(tmpCodeStorageDir);

  return contractBytesDict;
}

export const WORMHOLE_CONTRACT_VERSION = "2.14.9";

// This method returns the file name which stores the deployment result for
// wormhole stub
export function getWormholeFileName(
  chainId: string,
  version: string,
  mainnet: boolean
): string {
  const WORMHOLE_STORAGE_DIR = mainnet
    ? "../wormhole-stub/mainnet"
    : "../wormhole-stub/testnet";

  return `${WORMHOLE_STORAGE_DIR}/${chainId}-${version}.json`;
}

// This method will read the wormhole file with the deployment resutt and will
// return the deployed wormhole contract address
export function getWormholeContractAddress(
  chainId: string,
  version: string,
  mainnet: boolean
): string {
  let deployedFilePath = getWormholeFileName(chainId, version, mainnet);
  const wormholeContractAddress = JSON.parse(
    readFileSync(deployedFilePath).toString()
  )["instantiate-contract"].result.contractAddr;

  if (wormholeContractAddress === undefined)
    throw new Error(
      "Wormhole contract address should be present in the file" +
        deployedFilePath
    );

  return wormholeContractAddress;
}

export function hexToBase64(hex: string): string {
  return Buffer.from(hex, "hex").toString("base64");
}
