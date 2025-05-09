"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signBid = signBid;
exports.getSignature = getSignature;
exports.signOpportunityBid = signOpportunityBid;
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const index_1 = require("./index");
const const_1 = require("./const");
const abi_1 = require("./abi");
/**
 * Converts sellTokens, bidAmount, and callValue to permitted tokens
 * @param tokens List of sellTokens
 * @param bidAmount
 * @param callValue
 * @param weth
 * @returns List of permitted tokens
 */
function getPermittedTokens(tokens, bidAmount, callValue, weth) {
  const permitted = tokens.map(({ token, amount }) => ({
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
function getOpportunityConfig(chainId) {
  const opportunityAdapterConfig = const_1.OPPORTUNITY_ADAPTER_CONFIGS[chainId];
  if (!opportunityAdapterConfig) {
    throw new index_1.ClientError(
      `Opportunity adapter config not found for chain id: ${chainId}`,
    );
  }
  return opportunityAdapterConfig;
}
async function signBid(opportunity, bidParams, privateKey) {
  const opportunityAdapterConfig = getOpportunityConfig(opportunity.chainId);
  const executor = (0, accounts_1.privateKeyToAccount)(privateKey).address;
  const permitted = getPermittedTokens(
    opportunity.sellTokens,
    bidParams.amount,
    opportunity.targetCallValue,
    (0, index_1.checkAddress)(opportunityAdapterConfig.weth),
  );
  const signature = await getSignature(opportunity, bidParams, privateKey);
  const calldata = makeAdapterCalldata(
    opportunity,
    permitted,
    executor,
    bidParams,
    signature,
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
  opportunity,
  permitted,
  executor,
  bidParams,
  signature,
) {
  return (0, viem_1.encodeFunctionData)({
    abi: [abi_1.executeOpportunityAbi],
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
async function getSignature(opportunity, bidParams, privateKey) {
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
  const account = (0, accounts_1.privateKeyToAccount)(privateKey);
  const executor = account.address;
  const opportunityAdapterConfig = getOpportunityConfig(opportunity.chainId);
  const permitted = getPermittedTokens(
    opportunity.sellTokens,
    bidParams.amount,
    opportunity.targetCallValue,
    (0, index_1.checkAddress)(opportunityAdapterConfig.weth),
  );
  const create2Address = (0, viem_1.getContractAddress)({
    bytecodeHash:
      opportunityAdapterConfig.opportunity_adapter_init_bytecode_hash,
    from: opportunityAdapterConfig.opportunity_adapter_factory,
    opcode: "CREATE2",
    salt: `0x${executor.replace("0x", "").padStart(64, "0")}`,
  });
  return (0, accounts_1.signTypedData)({
    privateKey,
    domain: {
      name: "Permit2",
      verifyingContract: (0, index_1.checkAddress)(
        opportunityAdapterConfig.permit2,
      ),
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
async function signOpportunityBid(opportunity, bidParams, privateKey) {
  const account = (0, accounts_1.privateKeyToAccount)(privateKey);
  const signature = await getSignature(opportunity, bidParams, privateKey);
  return {
    permissionKey: opportunity.permissionKey,
    bid: bidParams,
    executor: account.address,
    signature,
    opportunityId: opportunity.opportunityId,
  };
}
