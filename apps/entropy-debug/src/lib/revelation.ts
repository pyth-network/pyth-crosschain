import { createPublicClient, http, parseEventLogs, publicActions } from 'viem'
import { EntropyAbi } from './EntropyAbi'
import { EntropyDeployment, EntropyDeployments } from "@/store/EntropyDeployments";

interface Revelation {
  value: {
    data: string;
  };
}

export async function requestCallback(txHash: string, chain: string): Promise<string> {
  console.log("requestCallback", txHash, chain)
  const deployment = EntropyDeployments[chain]
  console.log("deployment", deployment)
  if (!deployment) {
    console.error("Deployment for chain not found", chain)
    throw new Error(`Deployment for chain ${chain} not found`)
  }

  let provider: string
  let sequenceNumber: bigint
  let userRandomNumber: string

  try {
    ({ provider, sequenceNumber, userRandomNumber } = await fetchInfoFromTx(txHash, deployment))
  } catch (error) {
    console.error("Error fetching info from tx:", error)
    throw new Error("We found an error message: " + error)
  }

  let revelation: string | Revelation
  try {
    revelation = await getRevelation(chain, Number(sequenceNumber))
  } catch (error) {
    console.error("Error fetching revelation:", error)
    throw new Error("We found an error message: " + error)
  }

  console.log("revelation", revelation)

  // It means the there is an error message
  if (typeof revelation === "string") {
    console.error("We found an error message: " + revelation)
    throw new Error("We found an error message: " + revelation)
  } 
  
  const message = `cast send ${deployment.address} 'revealWithCallback(address, uint64, bytes32, bytes32)' ${provider} ${sequenceNumber} ${userRandomNumber} ${revelation.value.data} -r ${deployment.rpc} --private-key <YOUR_PRIVATE_KEY>`
  console.log("message", message)
  
  return message
}

  export async function fetchInfoFromTx(txHash: string, deployment: EntropyDeployment) { 
    const publicClient = createPublicClient({
      transport: http(deployment.rpc)
    }).extend(publicActions)
    if (!publicClient) {
      throw new Error(`Error creating public client for ${deployment}`)
    }
  
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`
    })
    if (!receipt) {
      throw new Error(`Transaction receipt not found for ${txHash}`)
    }
    console.log("receipt: ", receipt)

    const logs = parseEventLogs({
      abi: EntropyAbi,
      logs: receipt.logs,
      eventName: "RequestedWithCallback"
    })
    if (!logs) {
      throw new Error(`Error parsing logs for ${txHash}. Are you sure you send the requestCallback Transaction?`)
    }
    console.log("logs: ", logs)
  
    if (logs.length === 0) {
      throw new Error(`No logs found for ${txHash}. Are you sure you send the requestCallback Transaction?`)
    }

    const provider = logs[0].args.provider
    const sequenceNumber = logs[0].args.sequenceNumber
    const userRandomNumber = logs[0].args.userRandomNumber

    return { provider, sequenceNumber, userRandomNumber }
  }
  
export async function getRevelation(chain: string, sequenceNumber: number) {
  const deployment = EntropyDeployments[chain]
  if (!deployment) {
    throw new Error(`Deployment for chain ${chain} not found`)
  }

  let response: Response
  
  try {
      const isMainnet = deployment.network === "mainnet"
      const baseUrl = isMainnet 
        ? "https://fortuna.dourolabs.app" 
        : "https://fortuna-staging.dourolabs.app"
      
      response = await fetch(
        `${baseUrl}/v1/chains/${chain}/revelations/${sequenceNumber}`,
        {
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )
    } catch (error) {
      console.error("We found an error while fetching the revelation: " + error)
      throw new Error("We found an error while fetching the revelation: " + error)
    }

  if (response.status.toString().startsWith("4") || response.status.toString().startsWith("5")) {
    const errorMessage = await response.text()
    console.error("The provider returned an error:", errorMessage)
    throw new Error("The provider returned an error: " + errorMessage)
  }

  return await response.json()
}