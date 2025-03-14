import { getContract, Address, GetContractReturnType } from "viem";
import { PythAbi } from "./pyth-abi";
import { SuperWalletClient } from "./super-wallet";

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
