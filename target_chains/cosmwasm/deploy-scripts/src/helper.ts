import { existsSync, mkdirSync, readFileSync } from "fs";
import { rimrafSync } from "rimraf";
import AdmZip from "adm-zip";
import path from "path";
import { DownloaderHelper } from "node-downloader-helper";

export type DeploymentType = "stable" | "beta";

// We have released the compile contacts on github. If a chain needs some specific
// feature in a contract, a version of the contract with that specific features is
// released. For example, "injective.zip" for injective.
// NOTE that each zip file should contain the compiled code with the same file
// name `pyth_cosmwasm.wasm`
// Given a contract version (eg 1.3.0) and  zipFileNames (eg ["injective", "osmosis"])
// this method will return an object with key = zipFileName and value = compiledCode
export async function getContractBytesDict(
  artifactZipFileNames: string[],
  version: string,
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
          tmpCodeStorageDir,
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
    }),
  );

  // extract zip files
  uniqueArtifactsZipName.map(async (artifactZipName) => {
    const zip = new AdmZip(
      path.resolve(tmpCodeStorageDir + "/" + artifactZipName + ".zip"),
    );
    zip.extractAllTo(path.resolve(tmpCodeStorageDir));
  });

  let contractBytesDict: { [fileName: string]: Buffer } = {};
  for (let uniqueArtifactZipName of uniqueArtifactsZipName) {
    const contractBytes = readFileSync(
      tmpCodeStorageDir + "/" + uniqueArtifactZipName + "/pyth_cosmwasm.wasm",
    );
    contractBytesDict[uniqueArtifactZipName] = contractBytes;
  }

  // clear tmp directory after downloading contracts
  rimrafSync(tmpCodeStorageDir);

  return contractBytesDict;
}
