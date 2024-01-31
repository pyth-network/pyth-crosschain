import { parseVaa } from "@certusone/wormhole-sdk";
import { EvmExecute, decodeGovernancePayload } from "xc_admin_common";
import { DefaultStore } from "./store";
import { PriceFeedContract, PrivateKey } from "./base";
import { EvmEntropyContract } from "./contracts";

/**
 * A general executor that tries to find any contract that can execute a given VAA and executes it
 * @param senderPrivateKey the private key to execute the governance instruction with
 * @param vaa the VAA to execute
 */
export async function executeVaa(senderPrivateKey: PrivateKey, vaa: Buffer) {
  const parsedVaa = parseVaa(vaa);
  const action = decodeGovernancePayload(parsedVaa.payload);
  if (!action) return; //TODO: handle other actions

  let contracts:
    | Record<string, PriceFeedContract>
    | Record<string, EvmEntropyContract>;
  if (action instanceof EvmExecute) contracts = DefaultStore.entropy_contracts;
  else contracts = DefaultStore.contracts;

  for (const contract of Object.values(contracts)) {
    if (
      action.targetChainId === "unset" ||
      contract.getChain().wormholeChainName === action.targetChainId
    ) {
      const governanceSource = await contract.getGovernanceDataSource();
      if (
        governanceSource.emitterAddress ===
          parsedVaa.emitterAddress.toString("hex") &&
        governanceSource.emitterChain === parsedVaa.emitterChain
      ) {
        const lastExecutedSequence =
          await contract.getLastExecutedGovernanceSequence();
        if (lastExecutedSequence >= parsedVaa.sequence) {
          console.log(
            `Skipping on contract ${contract.getId()} as it was already executed`
          );
          continue;
        }
        const { id } = await contract.executeGovernanceInstruction(
          senderPrivateKey,
          vaa
        );
        console.log(
          `Executed on contract ${contract.getId()} with txHash: ${id}`
        );
      }
    }
  }
}
