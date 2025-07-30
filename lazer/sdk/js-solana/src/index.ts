import type { PythLazerSolanaContract } from "./idl/pyth-lazer-solana-contract.js";
import IDL from "./idl/pyth-lazer-solana-contract.json" with { type: "json" };

export type { PythLazerSolanaContract } from "./idl/pyth-lazer-solana-contract.js";
export const PYTH_LAZER_SOLANA_CONTRACT_IDL = IDL as PythLazerSolanaContract;
export { createEd25519Instruction } from "./ed25519.js";
