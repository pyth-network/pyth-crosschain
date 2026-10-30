/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable unicorn/prefer-top-level-await */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  CardanoLazerContract,
  EvmExecutorContract,
  EvmLazerContract,
  SolanaLazerContract,
  StellarExecutorContract,
  StellarLazerContract,
  SuiLazerContract,
} from "../src/core/contracts";
import { DefaultStore } from "../src/node/utils/store";

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0 [--testnet] [--warn-within-days <n>]")
  .options({
    testnet: {
      default: false,
      desc: "Audit testnet contracts instead of mainnet",
      type: "boolean",
    },
    "warn-within-days": {
      default: 365,
      desc: "Flag a signer as EXPIRES_SOON if it expires within this many days",
      type: "number",
    },
  });

type GovernanceInfo = {
  /** The executor contract, or Solana's `top_authority`, that can govern the contract. */
  governed_by: string;
  /** Wormhole governance emitter the executor accepts VAAs from. */
  gov_emitter_chain: string;
  gov_emitter_address: string;
};

type SignerRow = {
  contract_id: string;
  chain: string;
  signer: string;
  expires_at_unix: string;
  expires_at_iso: string;
  status: string;
} & GovernanceInfo;

const UNKNOWN_GOVERNANCE: GovernanceInfo = {
  gov_emitter_address: "",
  gov_emitter_chain: "",
  governed_by: "",
};

/**
 * Resolve who governs a Lazer contract. EVM and Stellar are owned by a Wormhole
 * executor, so we report the executor and the emitter it trusts. Solana has no
 * Wormhole path: `top_authority` signs directly. Other ecosystems don't have a
 * governance reader yet and are left blank.
 */
async function getGovernance(
  contract: (typeof DefaultStore.lazer_contracts)[string],
): Promise<GovernanceInfo> {
  if (contract instanceof EvmLazerContract) {
    const executor = await contract.getOwner();
    // An owner without code can't be an executor; flag it rather than failing
    // on the executor's getters.
    if ((await contract.chain.getWeb3().eth.getCode(executor)) === "0x") {
      return {
        gov_emitter_address: "(owner has no code)",
        gov_emitter_chain: "",
        governed_by: executor,
      };
    }
    const source = await new EvmExecutorContract(
      contract.chain,
      executor,
    ).getGovernanceDataSource();
    return {
      gov_emitter_address: source.emitterAddress,
      gov_emitter_chain: source.emitterChain.toString(),
      governed_by: executor,
    };
  }
  if (contract instanceof StellarLazerContract) {
    const executor = await contract.getExecutor();
    const config = await new StellarExecutorContract(
      contract.chain,
      executor,
    ).getConfig();
    return {
      gov_emitter_address: config.ownerEmitterAddress,
      gov_emitter_chain: config.ownerEmitterChain.toString(),
      governed_by: executor,
    };
  }
  if (contract instanceof SolanaLazerContract) {
    return {
      ...UNKNOWN_GOVERNANCE,
      governed_by: await contract.getTopAuthority(),
    };
  }
  return UNKNOWN_GOVERNANCE;
}

function statusFor(
  expiresAt: bigint,
  nowSeconds: bigint,
  warnWithinSeconds: bigint,
): string {
  if (expiresAt <= nowSeconds) return "EXPIRED";
  if (expiresAt <= nowSeconds + warnWithinSeconds) return "EXPIRES_SOON";
  return "OK";
}

function makeRow(
  contractId: string,
  chain: string,
  signer: string,
  expiresAt: bigint,
  nowSeconds: bigint,
  warnWithinSeconds: bigint,
  governance: GovernanceInfo,
): SignerRow {
  return {
    chain,
    contract_id: contractId,
    expires_at_iso: new Date(Number(expiresAt) * 1000).toISOString(),
    expires_at_unix: expiresAt.toString(),
    signer,
    status: statusFor(expiresAt, nowSeconds, warnWithinSeconds),
    ...governance,
  };
}

async function main() {
  const argv = await parser.argv;

  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const warnWithinSeconds = BigInt(
    Math.round(argv["warn-within-days"] * 86_400),
  );

  const rows: SignerRow[] = [];

  for (const contract of Object.values(DefaultStore.lazer_contracts)) {
    if (contract.chain.isMainnet() === argv.testnet) continue;
    const contractId = contract.getId();
    const chain = contract.chain.getId();

    let governance = UNKNOWN_GOVERNANCE;
    try {
      governance = await getGovernance(contract);
    } catch (error) {
      console.error(`Error fetching governance for ${contractId}`, error);
    }

    try {
      if (contract instanceof SuiLazerContract) {
        for (const signer of await contract.getTrustedSigners()) {
          rows.push(
            makeRow(
              contractId,
              chain,
              signer.publicKey,
              signer.expiresAt,
              nowSeconds,
              warnWithinSeconds,
              governance,
            ),
          );
        }
      } else if (contract instanceof EvmLazerContract) {
        for (const signer of await contract.getTrustedSigners()) {
          rows.push(
            makeRow(
              contractId,
              chain,
              signer.address,
              signer.expiresAt,
              nowSeconds,
              warnWithinSeconds,
              governance,
            ),
          );
        }
      } else if (contract instanceof StellarLazerContract) {
        for (const signer of await contract.getTrustedSigners()) {
          rows.push(
            makeRow(
              contractId,
              chain,
              signer.publicKey,
              signer.expiresAt,
              nowSeconds,
              warnWithinSeconds,
              governance,
            ),
          );
        }
      } else if (contract instanceof CardanoLazerContract) {
        for (const signer of await contract.getTrustedSigners()) {
          rows.push(
            makeRow(
              contractId,
              chain,
              signer.publicKey,
              signer.expiresAt,
              nowSeconds,
              warnWithinSeconds,
              governance,
            ),
          );
        }
      } else if (contract instanceof SolanaLazerContract) {
        // The Solana program keeps two independent signer sets; distinguish them
        // by suffixing the chain column so each row is unambiguous.
        for (const signer of await contract.getTrustedSigners()) {
          rows.push(
            makeRow(
              contractId,
              `${chain} (ed25519)`,
              signer.publicKey,
              signer.expiresAt,
              nowSeconds,
              warnWithinSeconds,
              governance,
            ),
          );
        }
        for (const signer of await contract.getTrustedEcdsaSigners()) {
          rows.push(
            makeRow(
              contractId,
              `${chain} (ecdsa)`,
              signer.address,
              signer.expiresAt,
              nowSeconds,
              warnWithinSeconds,
              governance,
            ),
          );
        }
      }
    } catch (error) {
      console.error(`Error fetching trusted signers for ${contractId}`, error);
    }
  }

  console.table(rows);
}

main();
