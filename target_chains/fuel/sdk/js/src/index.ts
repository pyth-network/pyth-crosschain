import PYTH_CONTRACT_ABI from "./abi/pyth-contract-abi.json";

/** Address of the Pyth contract on Fuel Sepolia (testnet). */
export const PYTH_CONTRACT_ADDRESS_SEPOLIA =
  "0x1ab91bc1402a187055d3e827017ace566a103ce2a4126517da5d656d6a436aea";

/** Asset ID of ETH on Fuel. */
export const FUEL_ETH_ASSET_ID =
  "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07";

export { PYTH_CONTRACT_ABI };
export * from "./types";
export type * from "./types/PythContractAbi";
