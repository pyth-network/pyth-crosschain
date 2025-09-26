import { createPublicClient, http, parseEventLogs, publicActions, keccak256 } from "viem";
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

export async function getAllRequests(chain: keyof typeof EntropyDeployments) {
  const deployment = EntropyDeployments[chain];
  if (!deployment) {
    throw new Error(`Invalid chain: ${chain}`);
  }

  try {
    const client = createPublicClient({
      transport: http(deployment.rpc),
    }).extend(publicActions);

    // Get the latest block number
    const latestBlock = await client.getBlockNumber();

    // Look back 100 blocks for requests
    const fromBlock = latestBlock - BigInt(100);

    console.log(`Fetching logs for chain ${chain} from block ${fromBlock} to ${latestBlock}`);
    console.log(`Contract address: ${deployment.address}`);

    // Get logs using the event from the ABI
    const logs = await client.getLogs({
      address: deployment.address as `0x${string}`,
      fromBlock,
      toBlock: latestBlock,
      event: EntropyAbi.find(event => event.name === "RequestedWithCallback" && event.type === "event")!,
    });

    console.log(`Found ${logs.length} logs for chain ${chain}`);

    return logs.map(log => ({
      chain,
      network: deployment.network,
      provider: log.args.provider!,
      sequenceNumber: log.args.sequenceNumber!,
      userRandomNumber: log.args.userRandomNumber!,
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
    }));
  } catch (error) {
    console.error(`Error fetching logs for chain ${chain}:`, error);
    return [];
  }
}

export async function getRequestBySequenceNumber(
  chain: keyof typeof EntropyDeployments,
  sequenceNumber: string
) {
  const deployment = EntropyDeployments[chain];
  if (!deployment) {
    throw new Error(`Invalid chain: ${chain}`);
  }

  try {
    const client = createPublicClient({
      transport: http(deployment.rpc),
    }).extend(publicActions);

    // Get the latest block number
    const latestBlock = await client.getBlockNumber();

    // Look back 10000 blocks for requests
    const fromBlock = latestBlock - BigInt(10_000);

    // Get logs for the specific sequence number
    const logs = await client.getLogs({
      address: deployment.address as `0x${string}`,
      fromBlock: fromBlock,
      toBlock: latestBlock,
      event: EntropyAbi.find(event => event.name === "RequestedWithCallback" && event.type === "event")!,
      args: {
        sequenceNumber: BigInt(sequenceNumber)
      }
    });

    if (logs.length > 0) {
      const log = logs[0] as {
        args: {
          provider: `0x${string}`;
          sequenceNumber: bigint;
          userRandomNumber: `0x${string}`;
        };
        transactionHash: `0x${string}`;
        blockNumber: bigint;
      };

      return {
        chain,
        network: deployment.network,
        provider: log.args.provider,
        sequenceNumber: log.args.sequenceNumber,
        userRandomNumber: log.args.userRandomNumber,
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
      };
    }

    return null;
  } catch (error) {
    console.error(`Error searching for sequence number ${sequenceNumber} on chain ${chain}:`, error);
    return null;
  }
}

export async function getRequestByTransactionHash(
  chain: keyof typeof EntropyDeployments,
  txHash: string
) {
  const deployment = EntropyDeployments[chain];
  if (!deployment) {
    throw new Error(`Invalid chain: ${chain}`);
  }

  try {
    const { provider, sequenceNumber, userRandomNumber } = await fetchInfoFromTx(txHash, deployment);

    const client = createPublicClient({
      transport: http(deployment.rpc),
    }).extend(publicActions);

    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    return {
      chain,
      network: deployment.network,
      provider,
      sequenceNumber,
      userRandomNumber,
      transactionHash: txHash as `0x${string}`,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error(`Error fetching request for transaction ${txHash} on chain ${chain}:`, error);
    return null;
  }
}
