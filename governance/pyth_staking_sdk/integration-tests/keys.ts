import fs from "node:fs";

import { Keypair } from "@solana/web3.js";

export function loadKeypair(path: string) {
  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(path, "utf8")) as number[]),
  );
}
