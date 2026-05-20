import { PublicKey } from "@solana/web3.js";
import {
  MESSAGE_BUFFER_PROGRAM_ID,
  REMOTE_EXECUTOR_ADDRESS,
} from "@pythnetwork/xc-admin-common";

/**
 * Registry of known Pyth programs deployed on Pythnet.
 * Sources are documented per entry; see https://docs.pyth.network/price-feeds/core/contract-addresses/pythnet
 */

export interface PythnetProgram {
  name: string;
  programId: PublicKey;
  source: string;
  isValidatorBuiltin: boolean;
}

// Oracle Program ID for pythnet cluster
// Source: @pythnetwork/client getPythProgramKeyForCluster("pythnet")
const ORACLE_PROGRAM_ID = new PublicKey(
  "FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH",
);

export const PYTHNET_PROGRAMS: PythnetProgram[] = [
  {
    name: "Oracle Program",
    // Source: docs.pyth.network/price-feeds/core/contract-addresses/pythnet
    programId: ORACLE_PROGRAM_ID,
    source: "docs.pyth.network/price-feeds/core/contract-addresses/pythnet",
    isValidatorBuiltin: false,
  },
  {
    name: "Remote Executor",
    // Source: @pythnetwork/xc-admin-common REMOTE_EXECUTOR_ADDRESS
    programId: REMOTE_EXECUTOR_ADDRESS,
    source: "docs.pyth.network/price-feeds/core/contract-addresses/pythnet",
    isValidatorBuiltin: false,
  },
  {
    name: "Message Buffer",
    // Source: @pythnetwork/xc-admin-common MESSAGE_BUFFER_PROGRAM_ID
    programId: MESSAGE_BUFFER_PROGRAM_ID,
    source: "docs.pyth.network/price-feeds/core/contract-addresses/pythnet",
    isValidatorBuiltin: false,
  },
];
