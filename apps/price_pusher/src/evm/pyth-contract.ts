import { getContract, type Address, type GetContractReturnType } from "viem";
import { PythAbi } from "./pyth-abi.js";
import type { SuperWalletClient } from "./super-wallet.js";

export type PythContract = GetContractReturnType<
  typeof PythAbi,
  SuperWalletClient
>;

export const createPythContract = (
  client: SuperWalletClient,
  address: Address,
): PythContract =>
  getContract({
    client,
    abi: PythAbi,
    address,
  });
