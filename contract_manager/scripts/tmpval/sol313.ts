import { Connection, PublicKey } from "@solana/web3.js";
import { createHash } from "node:crypto";
const conn = new Connection("https://api.mainnet-beta.solana.com");
const fogo = new Connection("https://mainnet.fogo.io");
async function idProgram(c: Connection, label: string, pk: string) {
  const i = await c.getAccountInfo(new PublicKey(pk));
  if (!i) return console.log(`${label} ${pk} -> NOT FOUND`);
  if (i.executable && i.data.length === 36) {
    const pd = new PublicKey(i.data.subarray(4, 36));
    console.log(`${label} ${pk} -> PROGRAM, programdata=${pd.toBase58()}`);
  } else {
    console.log(`${label} ${pk} -> owner=${i.owner.toBase58()} exec=${i.executable} len=${i.data.length}`);
  }
}
async function bufferInfo(c: Connection, label: string, pk: string) {
  const i = await c.getAccountInfo(new PublicKey(pk));
  if (!i) return console.log(`${label} ${pk} -> NOT FOUND`);
  // UpgradeableLoaderState::Buffer = enum 1 + Option<Pubkey> authority (1+32) => 37 header
  const kind = i.data.readUInt32LE(0);
  const auth = i.data[4] === 1 ? new PublicKey(i.data.subarray(5, 37)).toBase58() : "none";
  const elf = i.data.subarray(37);
  console.log(`${label} ${pk} kind=${kind} authority=${auth} elfLen=${elf.length} sha256=${createHash("sha256").update(elf).digest("hex")}`);
}
async function programDataElf(c: Connection, label: string, pk: string) {
  const i = await c.getAccountInfo(new PublicKey(pk));
  if (!i) return console.log(`${label} ${pk} -> NOT FOUND`);
  // ProgramData = enum(4) + slot(8) + Option<Pubkey>(1+32) = 45 header
  const slot = i.data.readBigUInt64LE(4);
  const auth = i.data[12] === 1 ? new PublicKey(i.data.subarray(13, 45)).toBase58() : "none";
  const elf = i.data.subarray(45);
  const trimmed = elf.subarray(0, elf.length - (() => { let n = 0; for (let j = elf.length - 1; j >= 0 && elf[j] === 0; j--) n++; return n; })());
  console.log(`${label} ${pk} lastDeploySlot=${slot} upgradeAuthority=${auth} elfLen=${elf.length} sha256(full)=${createHash("sha256").update(elf).digest("hex")} sha256(trimmed)=${createHash("sha256").update(trimmed).digest("hex")} trimmedLen=${trimmed.length}`);
}
async function main() {
  console.log("--- SOLANA MAINNET ---");
  await idProgram(conn, "program?      ", "HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ");
  await idProgram(conn, "pyth receiver ", "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
  await programDataElf(conn, "programdata   ", "CmumsQAU6TvqW2VLFVySBjQYKqKDeUPMBVdrxJ2YoK1");
  await bufferInfo(conn, "new buffer    ", "XybuYMZCT6S2EKxFv9Sv39uLx8DBku2RjxwHfEWHQvJ");
  await idProgram(conn, "multisig auth ", "6oXTdojyfDS8m5VtTaYB9xRCxpKGSvKJFndLUPV3V3wT");
  const cfg = await conn.getAccountInfo(new PublicKey("DaWUKXCyXsnzcvLUyeJRWou8KTn7XtadgTsdhJ6RHS7b"));
  console.log("receiver config account len:", cfg?.data.length, "owner:", cfg?.owner.toBase58());
  console.log("\n--- FOGO MAINNET ---");
  try {
    await idProgram(fogo, "program?      ", "HDwcJBJXjL9FpJ7UBsYBtaDjsBUhuLCUYoz3zr8SWWaQ");
    await programDataElf(fogo, "programdata   ", "CmumsQAU6TvqW2VLFVySBjQYKqKDeUPMBVdrxJ2YoK1");
    await bufferInfo(fogo, "new buffer    ", "EGq9aToMraKE6sJhnS6yWrwbS7BeEbZVRvyJGJ15DhUK");
    await idProgram(fogo, "executor auth ", "DgpbK8SiypiUHBkBTAunMnwRWF3McGGR4iKxTrTfTXq4");
  } catch (e: any) { console.log("fogo err:", e.message); }
}
main();
