import PYTH_CONTRACT_ABI from "./abi/pyth-contract-abi.json";

/** Address of the Pyth contract on Fuel Sepolia (testnet). */
export const PYTH_CONTRACT_ADDRESS_SEPOLIA =
  "0x73591bf32f010ce4e83d86005c24e7833b397be38014ab670a73f6fde59ad607";

/** Asset ID of ETH on Fuel. */
export const FUEL_ETH_ASSET_ID =
  "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07";

export { PYTH_CONTRACT_ABI };
export * from "./types";
export type * from "./types/PythContractAbi";
