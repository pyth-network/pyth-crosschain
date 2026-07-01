/** biome-ignore-all lint/suspicious/noConsole: this is a CLI script */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable unicorn/prefer-top-level-await */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import {
  EvmLazerContract,
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

type SignerRow = {
  contract_id: string;
  chain: string;
  signer: string;
  expires_at_unix: string;
  expires_at_iso: string;
  status: string;
};

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
): SignerRow {
  return {
    chain,
    contract_id: contractId,
    expires_at_iso: new Date(Number(expiresAt) * 1000).toISOString(),
    expires_at_unix: expiresAt.toString(),
    signer,
    status: statusFor(expiresAt, nowSeconds, warnWithinSeconds),
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
