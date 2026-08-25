import { Connection, PublicKey } from "@solana/web3.js";
import { writeFileSync } from "node:fs";
const c = new Connection("https://api.mainnet-beta.solana.com");
const i = await 0;
async function main() {
  const acc = await c.getAccountInfo(new PublicKey("XybuYMZCT6S2EKxFv9Sv39uLx8DBku2RjxwHfEWHQvJ"));
  if (!acc) throw new Error("no buffer");
  writeFileSync("/tmp/onchain_buffer.so", acc.data.subarray(37));
  console.log("wrote", acc.data.length - 37, "bytes");
}
main();
