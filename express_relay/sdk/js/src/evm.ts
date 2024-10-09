import {
  Bid,
  BidParams,
  OpportunityBid,
  OpportunityEvm,
  TokenAmount,
  TokenPermissions,
} from "./types";
import { Address, encodeFunctionData, getContractAddress, Hex } from "viem";
import { privateKeyToAccount, signTypedData } from "viem/accounts";
import { checkAddress, ClientError } from "./index";
import { OPPORTUNITY_ADAPTER_CONFIGS } from "./const";
import { executeOpportunityAbi } from "./abi";

/**
 * Converts sellTokens, bidAmount, and callValue to permitted tokens
 * @param tokens List of sellTokens
 * @param bidAmount
 * @param callValue
 * @param weth
 * @returns List of permitted tokens
 */
function getPermittedTokens(
  tokens: TokenAmount[],
  bidAmount: bigint,
  callValue: bigint,
  weth: Address
): TokenPermissions[] {
  const permitted: TokenPermissions[] = tokens.map(({ token, amount }) => ({
    token,
    amount,
  }));
  const wethIndex = permitted.findIndex(({ token }) => token === weth);
  const extraWethNeeded = bidAmount + callValue;
  if (wethIndex !== -1) {
    permitted[wethIndex].amount += extraWethNeeded;
    return permitted;
  }
  if (extraWethNeeded > 0) {
    permitted.push({ token: weth, amount: extraWethNeeded });
  }
  return permitted;
}

function getOpportunityConfig(chainId: string) {
  const opportunityAdapterConfig = OPPORTUNITY_ADAPTER_CONFIGS[chainId];
  if (!opportunityAdapterConfig) {
    throw new ClientError(
      `Opportunity adapter config not found for chain id: ${chainId}`
    );
  }
  return opportunityAdapterConfig;
}

export async function signBid(
  opportunity: OpportunityEvm,
  bidParams: BidParams,
  privateKey: Hex
): Promise<Bid> {
  const opportunityAdapterConfig = getOpportunityConfig(opportunity.chainId);
  const executor = privateKeyToAccount(privateKey).address;
  const permitted = getPermittedTokens(
    opportunity.sellTokens,
    bidParams.amount,
    opportunity.targetCallValue,
    checkAddress(opportunityAdapterConfig.weth)
  );
  const signature = await getSignature(opportunity, bidParams, privateKey);

  const calldata = makeAdapterCalldata(
    opportunity,
    permitted,
    executor,
    bidParams,
    signature
  );

  return {
    amount: bidParams.amount,
    targetCalldata: calldata,
    chainId: opportunity.chainId,
    targetContract: opportunityAdapterConfig.opportunity_adapter_factory,
    permissionKey: opportunity.permissionKey,
    env: "evm",
  };
}

/**
 * Constructs the calldata for the opportunity adapter contract.
 * @param opportunity Opportunity to bid on
 * @param permitted Permitted tokens
 * @param executor Address of the searcher's wallet
 * @param bidParams Bid amount, nonce, and deadline timestamp
 * @param signature Searcher's signature for opportunity params and bidParams
 * @returns Calldata for the opportunity adapter contract
 */
function makeAdapterCalldata(
  opportunity: OpportunityEvm,
  permitted: TokenPermissions[],
  executor: Address,
  bidParams: BidParams,
  signature: Hex
): Hex {
  return encodeFunctionData({
    abi: [executeOpportunityAbi],
    args: [
      [
        [permitted, bidParams.nonce, bidParams.deadline],
        [
          opportunity.buyTokens,
          executor,
          opportunity.targetContract,
          opportunity.targetCalldata,
          opportunity.targetCallValue,
          bidParams.amount,
        ],
      ],
      signature,
    ],
  });
}

export async function getSignature(
  opportunity: OpportunityEvm,
  bidParams: BidParams,
  privateKey: Hex
): Promise<`0x${string}`> {
  const types = {
    PermitBatchWitnessTransferFrom: [
      { name: "permitted", type: "TokenPermissions[]" },
      { name: "spender", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "witness", type: "OpportunityWitness" },
    ],
    OpportunityWitness: [
      { name: "buyTokens", type: "TokenAmount[]" },
      { name: "executor", type: "address" },
      { name: "targetContract", type: "address" },
      { name: "targetCalldata", type: "bytes" },
      { name: "targetCallValue", type: "uint256" },
      { name: "bidAmount", type: "uint256" },
    ],
    TokenAmount: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    TokenPermissions: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  };

  const account = privateKeyToAccount(privateKey);
  const executor = account.address;
  const opportunityAdapterConfig = getOpportunityConfig(opportunity.chainId);
  const permitted = getPermittedTokens(
    opportunity.sellTokens,
    bidParams.amount,
    opportunity.targetCallValue,
    checkAddress(opportunityAdapterConfig.weth)
  );
  const create2Address = getContractAddress({
    bytecodeHash:
      opportunityAdapterConfig.opportunity_adapter_init_bytecode_hash,
    from: opportunityAdapterConfig.opportunity_adapter_factory,
    opcode: "CREATE2",
    salt: `0x${executor.replace("0x", "").padStart(64, "0")}`,
  });

  return signTypedData({
    privateKey,
    domain: {
      name: "Permit2",
      verifyingContract: checkAddress(opportunityAdapterConfig.permit2),
      chainId: opportunityAdapterConfig.chain_id,
    },
    types,
    primaryType: "PermitBatchWitnessTransferFrom",
    message: {
      permitted,
      spender: create2Address,
      nonce: bidParams.nonce,
      deadline: bidParams.deadline,
      witness: {
        buyTokens: opportunity.buyTokens,
        executor,
        targetContract: opportunity.targetContract,
        targetCalldata: opportunity.targetCalldata,
        targetCallValue: opportunity.targetCallValue,
        bidAmount: bidParams.amount,
      },
    },
  });
}

export async function signOpportunityBid(
  opportunity: OpportunityEvm,
  bidParams: BidParams,
  privateKey: Hex
): Promise<OpportunityBid> {
  const account = privateKeyToAccount(privateKey);
  const signature = await getSignature(opportunity, bidParams, privateKey);

  return {
    permissionKey: opportunity.permissionKey,
    bid: bidParams,
    executor: account.address,
    signature,
    opportunityId: opportunity.opportunityId,
  };
}
