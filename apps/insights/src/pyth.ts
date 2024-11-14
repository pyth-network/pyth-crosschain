import {
  PythHttpClient,
  PythConnection,
  getPythClusterApiUrl,
  getPythProgramKeyForCluster,
} from "@pythnetwork/client";
import type { PythPriceCallback } from "@pythnetwork/client/lib/PythConnection";
import { Connection, PublicKey } from "@solana/web3.js";

const CLUSTER = "pythnet";

export const connection = new Connection(getPythClusterApiUrl(CLUSTER));
export const programKey = getPythProgramKeyForCluster(CLUSTER);
export const client = new PythHttpClient(connection, programKey);
export const subscribe = (feeds: PublicKey[], cb: PythPriceCallback) => {
  const pythConn = new PythConnection(
    connection,
    programKey,
    "confirmed",
    feeds,
  );
  pythConn.onPriceChange(cb);
  return pythConn;
};
