import { DataSource } from "@pythnetwork/xc-admin-common";
import { Cell, Transaction } from "@ton/core";
import { Buffer } from "buffer";

const GOVERNANCE_MAGIC = 0x5054474d;
const GOVERNANCE_MODULE = 1;
const AUTHORIZE_UPGRADE_CONTRACT_ACTION = 0;
const TARGET_CHAIN_ID = 1;

// Helper function to parse DataSource from a Cell
export function parseDataSource(cell: Cell): DataSource {
  const slice = cell.beginParse();
  const emitterChain = slice.loadUint(16);
  const emitterAddress = slice.loadUint(256).toString(16).padStart(64, "0");
  return { emitterChain, emitterAddress };
}

function computedGeneric(transaction: Transaction) {
  if (transaction.description.type !== "generic")
    throw "Expected generic transactionaction";
  if (transaction.description.computePhase.type !== "vm")
    throw "Compute phase expected";
  return transaction.description.computePhase;
}

export function printTxGasStats(name: string, transaction: Transaction) {
  const txComputed = computedGeneric(transaction);
  console.log(`${name} used ${txComputed.gasUsed} gas`);
  console.log(`${name} gas cost: ${txComputed.gasFees}`);
  return txComputed.gasFees;
}

export function createAuthorizeUpgradePayload(newCodeHash: Buffer): Buffer {
  const payload = Buffer.alloc(8);
  payload.writeUInt32BE(GOVERNANCE_MAGIC, 0);
  payload.writeUInt8(GOVERNANCE_MODULE, 4);
  payload.writeUInt8(AUTHORIZE_UPGRADE_CONTRACT_ACTION, 5);
  payload.writeUInt16BE(TARGET_CHAIN_ID, 6);

  return Buffer.concat([payload, newCodeHash]);
}
