import { parseVaa } from "@certusone/wormhole-sdk";
import { decodeGovernancePayload } from "xc_admin_common";
import { DefaultStore } from "./store";

/**
 * A general executor that tries to find any contract that can execute a given VAA and executes it
 * @param senderPrivateKey the private key to execute the governance instruction with
 * @param vaa the VAA to execute
 */
export async function executeVaa(senderPrivateKey: string, vaa: Buffer) {
  const parsedVaa = parseVaa(vaa);
  const action = decodeGovernancePayload(parsedVaa.payload);
  if (!action) return; //TODO: handle other actions
  for (const contract of Object.values(DefaultStore.contracts)) {
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
        // TODO: check governance sequence number as well
        await contract.executeGovernanceInstruction(senderPrivateKey, vaa);
      }
    }
  }
}
