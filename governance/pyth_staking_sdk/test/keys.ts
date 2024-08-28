import { Keypair } from "@solana/web3.js";
import fs from "fs";

export function loadKeypair(path: string) {
  return Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(path, "utf-8")))
  );
}
