import PYTH_CONTRACT_ABI from "./abi/pyth-contract-abi.json";

/** Address of the Pyth contract on Fuel Sepolia (testnet). */
export const PYTH_CONTRACT_ADDRESS_SEPOLIA =
  "0x25146735b29d4216639f7f8b1d7b921ff87a1d3051de62d6cceaacabeb33b8e7";

/** Address of the Pyth contract on Fuel Mainnet. */
export const PYTH_CONTRACT_ADDRESS_MAINNET =
  "0x1c86fdd9e0e7bc0d2ae1bf6817ef4834ffa7247655701ee1b031b52a24c523da";

/** Asset ID of ETH on Fuel. */
export const FUEL_ETH_ASSET_ID =
  "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07";

export { PYTH_CONTRACT_ABI };
export * from "./types";
export type * from "./types/PythContract";
