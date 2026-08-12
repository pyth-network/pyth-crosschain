/** biome-ignore-all lint/suspicious/noConsole: CLI script */
import { readFileSync } from "node:fs";

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { toPrivateKey } from "../src/core/base";
import { loadHotWallet } from "../src/node/utils/governance";
import { DefaultStore } from "../src/node/utils/store";
import {
  COMMON_UPGRADE_OPTIONS,
  getSelectedChains,
  makeCacheFunction,
} from "./common";

const CACHE_FILE = ".cache-upgrade-evm";
const runIfNotCached = makeCacheFunction(CACHE_FILE);

const parser = yargs(hideBin(process.argv))
  .usage(
    "Deploys a new PythUpgradable contract to a set of chains and creates a governance proposal for it.\n" +
      `Uses a cache file (${CACHE_FILE}) to avoid deploying contracts twice\n` +
      "Usage: $0 --chain <chain_1> --chain <chain_2> --private-key <private_key> --ops-key-path <ops_key_path> --std-output <std_output>",
  )
  .options({
    ...COMMON_UPGRADE_OPTIONS,
    "library-std-output": {
      demandOption: false,
      desc:
        "Path to the standard JSON output of a library the pyth contract links against " +
        "(e.g. PythGovernanceModule). Repeat once per library. Each library is deployed to " +
        "every selected chain and its address is spliced into the pyth bytecode.",
      string: true,
      type: "array",
    },
  });

type LinkPosition = { start: number; length: number };

/** The subset of a forge build artifact that this script reads. */
type ForgeArtifact = {
  abi: unknown[];
  bytecode: {
    object: string;
    linkReferences?: Record<string, Record<string, LinkPosition[]>>;
  };
  metadata?: { settings?: { compilationTarget?: Record<string, string> } };
};

/** One entry per library that a forge artifact links against. */
type LinkReference = {
  file: string;
  name: string;
  positions: LinkPosition[];
};

function readArtifact(path: string): ForgeArtifact {
  return JSON.parse(readFileSync(path, "utf8")) as ForgeArtifact;
}

function getLinkReferences(artifact: ForgeArtifact): LinkReference[] {
  return Object.entries(artifact.bytecode.linkReferences ?? {}).flatMap(
    ([file, libraries]) =>
      Object.entries(libraries).map(([name, positions]) => ({
        file,
        name,
        positions,
      })),
  );
}

/** The `path/To/File.sol:LibraryName` that a forge artifact was compiled for. */
function getCompilationTarget(artifact: ForgeArtifact): string {
  const target = artifact.metadata?.settings?.compilationTarget ?? {};
  const [file, name] = Object.entries(target)[0] ?? [];
  if (file === undefined || name === undefined) {
    throw new TypeError(
      "Could not read metadata.settings.compilationTarget from the library artifact; " +
        "make sure it is a forge build artifact",
    );
  }
  return `${file}:${name}`;
}

/**
 * Replaces the `__$<hash>$__` placeholders that forge leaves in unlinked bytecode
 * with concrete library addresses. Positions are byte offsets into the bytecode,
 * so each one maps to two hex characters.
 */
function linkBytecode(
  bytecode: string,
  linkReferences: LinkReference[],
  addresses: Map<string, string>,
): string {
  const prefix = bytecode.startsWith("0x") ? "0x" : "";
  let hex = bytecode.slice(prefix.length);

  for (const { file, name, positions } of linkReferences) {
    const address = addresses.get(`${file}:${name}`);
    if (address === undefined) {
      throw new Error(
        `No address for library ${file}:${name}; pass its build artifact with --library-std-output`,
      );
    }
    const addressHex = address.replace("0x", "").toLowerCase();
    for (const { start, length } of positions) {
      hex =
        hex.slice(0, 2 * start) + addressHex + hex.slice(2 * (start + length));
    }
  }

  if (/__\$[\da-f]{34}\$__/.test(hex)) {
    throw new Error("Bytecode still contains unresolved library placeholders");
  }
  return prefix + hex;
}

async function main() {
  const argv = await parser.argv;
  const selectedChains = getSelectedChains(argv);

  const stdOutput = argv["std-output"];
  if (stdOutput === undefined) {
    throw new Error("--std-output is required");
  }

  const vault =
    DefaultStore.vaults[
      "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj"
    ];

  console.log("Using cache file", CACHE_FILE);
  console.log(
    "Upgrading on chains",
    selectedChains.map((c) => c.getId()),
  );

  const libraryArtifacts = (argv["library-std-output"] ?? []).map((path) =>
    readArtifact(path),
  );

  const payloads: Buffer[] = [];
  for (const chain of selectedChains) {
    const artifact = readArtifact(stdOutput);

    // A linked library's address is baked into the implementation's code, so
    // every library has to be deployed on the chain before the implementation.
    const linkReferences = getLinkReferences(artifact);
    const libraryAddresses = new Map<string, string>();
    for (const libraryArtifact of libraryArtifacts) {
      const target = getCompilationTarget(libraryArtifact);
      console.log(`Deploying library ${target} to`, chain.getId());
      const libraryAddress = await runIfNotCached(
        `deploy-library-${target}-${chain.getId()}`,
        () => {
          return chain.deploy(
            toPrivateKey(argv["private-key"]),
            libraryArtifact.abi,
            libraryArtifact.bytecode.object,
            [],
          );
        },
      );
      console.log(
        `Deployed library ${target} at ${libraryAddress} on ${chain.getId()}`,
      );
      libraryAddresses.set(target, libraryAddress);
    }

    // As per the artifacts generated by forge, bytecode is an object with an 'object' property
    const bytecode = linkBytecode(
      artifact.bytecode.object,
      linkReferences,
      libraryAddresses,
    );

    console.log("Deploying contract to", chain.getId());
    const address = await runIfNotCached(`deploy-${chain.getId()}`, () => {
      return chain.deploy(
        toPrivateKey(argv["private-key"]),
        artifact.abi,
        bytecode,
        [],
      );
    });
    console.log(`Deployed contract at ${address} on ${chain.getId()}`);
    payloads.push(
      chain.generateGovernanceUpgradePayload(address.replace("0x", "")),
    );
  }

  console.log("Using vault at for proposal", vault?.getId());
  const wallet = await loadHotWallet(argv["ops-key-path"]);
  console.log("Using wallet", wallet.publicKey.toBase58());
  await vault?.connect(wallet);
  const proposal = await vault?.proposeWormholeMessage(payloads);
  console.log("Proposal address", proposal?.address.toBase58());
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();
