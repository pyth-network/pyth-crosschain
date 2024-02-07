import { EvmChain, PrivateKey } from "../src";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";

interface DeployConfig {
  gasMultiplier: number;
  gasPriceMultiplier: number;
  jsonOutputDir: string;
  privateKey: PrivateKey;
}

// Deploys a contract if it was not deployed before.
// It will check for the past deployments in file `cacheFile` against a key
// If `cacheKey` is provided it will be used as the key, else it will use
// a key - `${chain.getId()}-${artifactName}`
export async function deployIfNotCached(
  cacheFile: string,
  chain: EvmChain,
  config: DeployConfig,
  artifactName: string,
  deployArgs: any[], // eslint-disable-line  @typescript-eslint/no-explicit-any
  cacheKey?: string
): Promise<string> {
  const cache = existsSync(cacheFile)
    ? JSON.parse(readFileSync(cacheFile, "utf8"))
    : {};

  const key = cacheKey ?? `${chain.getId()}-${artifactName}`;
  if (cache[key]) {
    const address = cache[key];
    console.log(
      `Using cached deployment of ${artifactName} on ${chain.getId()} at ${address}`
    );
    return address;
  }

  const artifact = JSON.parse(
    readFileSync(join(config.jsonOutputDir, `${artifactName}.json`), "utf8")
  );

  console.log(`Deploying ${artifactName} on ${chain.getId()}...`);

  const addr = await chain.deploy(
    config.privateKey,
    artifact["abi"],
    artifact["bytecode"],
    deployArgs,
    config.gasMultiplier,
    config.gasPriceMultiplier
  );

  console.log(`✅ Deployed ${artifactName} on ${chain.getId()} at ${addr}`);

  cache[key] = addr;
  writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
  return addr;
}

export function getWeb3Contract(
  jsonOutputDir: string,
  artifactName: string,
  address: string
): Contract {
  const artifact = JSON.parse(
    readFileSync(join(jsonOutputDir, `${artifactName}.json`), "utf8")
  );
  const web3 = new Web3();
  return new web3.eth.Contract(artifact["abi"], address);
}
