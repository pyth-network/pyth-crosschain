import "server-only";

import { PythStakingClient } from "@pythnetwork/staking-sdk";
import { Connection } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");
export const client = new PythStakingClient({ connection });
