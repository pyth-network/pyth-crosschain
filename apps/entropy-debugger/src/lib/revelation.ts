import { createPublicClient, http, parseEventLogs, publicActions } from "viem";
import { z } from "zod";

import { EntropyAbi } from "./entropy-abi";
import type { EntropyDeployment } from "../store/entropy-deployments";
import { EntropyDeployments } from "../store/entropy-deployments";

export async function requestCallback(
  txHash: string,
  chain: keyof typeof EntropyDeployments,
): Promise<string> {
  const deployment = EntropyDeployments[chain];
  const { provider, sequenceNumber, userRandomNumber, blockNumber } =
    await fetchInfoFromTx(txHash, deployment);
  const revelation = await getRevelation(
    chain,
    blockNumber,
    Number(sequenceNumber),
  );

  return `cast send ${deployment.address} 'revealWithCallback(address, uint64, bytes32, bytes32)' ${provider} ${sequenceNumber.toString()} ${userRandomNumber} ${revelation.value.data} -r ${deployment.rpc} --private-key <YOUR_PRIVATE_KEY>`;
}

export async function fetchInfoFromTx(
  txHash: string,
  deployment: EntropyDeployment,
) {
  const receipt = await createPublicClient({
    transport: http(deployment.rpc),
  })
    .extend(publicActions)
    .getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

  const logs = parseEventLogs({
    abi: EntropyAbi,
    logs: receipt.logs,
    eventName: "RequestedWithCallback",
  });

  const firstLog = logs[0];
  if (firstLog) {
    const { provider, sequenceNumber, userRandomNumber } = firstLog.args;
    return {
      provider,
      sequenceNumber,
      userRandomNumber,
      blockNumber: receipt.blockNumber,
    };
  } else {
    throw new Error(
      `No logs found for ${txHash}. Are you sure you send the requestCallback Transaction?`,
    );
  }
}

export async function getRevelation(
  chain: keyof typeof EntropyDeployments,
  blockNumber: bigint,
  sequenceNumber: number,
) {
  const deployment = EntropyDeployments[chain];
  const url = new URL(
    `/v1/chains/${chain}/revelations/${sequenceNumber.toString()}?block_number=${blockNumber.toString()}`,
    deployment.network === "mainnet"
      ? "https://fortuna.dourolabs.app"
      : "https://fortuna-staging.dourolabs.app",
  );
  const response = await fetch(url);

  if (response.ok) {
    return revelationSchema.parse(await response.json());
  } else {
    throw new Error(`The provider returned an error: ${await response.text()}`);
  }
}

const revelationSchema = z.object({
  value: z.object({
    data: z.string(),
  }),
});
