/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable unicorn/catch-error-name */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable no-console */
import { exec } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";

import { loadKeypair } from "./keys";
import {
  INTEGRITY_POOL_PROGRAM_ADDRESS,
  PUBLISHER_CAPS_PROGRAM_ADDRESS,
  STAKING_PROGRAM_ADDRESS,
} from "../src/constants";

export function getConnection(): Connection {
  return new Connection(
    `http://127.0.0.1:8899`,
    AnchorProvider.defaultOptions().commitment,
  );
}

/**
 * If we abort immediately, the web-sockets are still subscribed, and they give a ton of errors.
 * Waiting a few seconds is enough to let the sockets close.
 */
export class CustomAbortController {
  abortController: AbortController;
  constructor(abortController: AbortController) {
    this.abortController = abortController;
  }
  abort() {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.abortController.abort();
        resolve(undefined);
      }, 5000);
    });
  }
}

/* Starts a validator at port portNumber with the command line arguments specified after a few basic ones
 *
 * returns a `{ controller, connection }` struct. Users of this method have to terminate the
 * validator by calling :
 * ```controller.abort()```
 */
export async function startValidatorRaw() {
  const connection: Connection = getConnection();
  const ledgerDir = await mkdtemp(path.join(os.tmpdir(), "ledger-"));

  const internalController: AbortController = new AbortController();
  const { signal } = internalController;

  const user = loadKeypair(
    "integration-tests/keypairs/localnet-authority.json",
  );

  const command = `solana-test-validator \
    --ledger ${ledgerDir} \
    --reset \
    --mint ${user.publicKey.toBase58()} \
    --bpf-program ${STAKING_PROGRAM_ADDRESS.toBase58()} integration-tests/programs/staking.so \
    --bpf-program ${INTEGRITY_POOL_PROGRAM_ADDRESS.toBase58()} integration-tests/programs/integrity_pool.so \
    --bpf-program ${PUBLISHER_CAPS_PROGRAM_ADDRESS.toBase58()} integration-tests/programs/publisher_caps.so \
    `;

  exec(command, { signal }, (error, stdout, stderr) => {
    if (error?.name.includes("AbortError")) {
      // Test complete, this is expected.
      return;
    }
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
    console.error(`stderr: ${stderr}`);
  });
  const controller = new CustomAbortController(internalController);

  let numRetries = 0;
  while (true) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await connection.getSlot();
      break;
    } catch (e) {
      // Bound the number of retries so the tests don't hang if there's some problem blocking
      // the connection to the validator.
      if (numRetries == 30) {
        console.log(
          `Failed to start validator or connect to running validator. Caught exception: ${e}`,
        );
        throw e;
      }
      numRetries += 1;
    }
  }

  return { controller, connection, wallet: new Wallet(user) };
}
