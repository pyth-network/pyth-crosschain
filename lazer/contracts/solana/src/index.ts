import { type PythLazerSolanaContract } from "./idl/pyth_lazer_solana_contract.js";
import * as IDL from "./idl/pyth_lazer_solana_contract.json" with { type: "json" };

export { type PythLazerSolanaContract } from "./idl/pyth_lazer_solana_contract.js";
export const PYTH_LAZER_SOLANA_CONTRACT_IDL = IDL as PythLazerSolanaContract;
export { createEd25519Instruction } from "./ed25519.js";
