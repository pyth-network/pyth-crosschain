import { IDL } from "./idl/pyth-lazer-solana-contract-data.js";
import type { PythLazerSolanaContract } from "./idl/pyth-lazer-solana-contract.js";

export type { PythLazerSolanaContract } from "./idl/pyth-lazer-solana-contract.js";
export const PYTH_LAZER_SOLANA_CONTRACT_IDL = IDL as PythLazerSolanaContract;
export { createEd25519Instruction } from "./ed25519.js";
