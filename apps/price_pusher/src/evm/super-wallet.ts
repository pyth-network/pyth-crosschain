import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  webSocket,
  Account,
  Chain,
  publicActions,
  Client,
  RpcSchema,
  WalletActions,
  PublicActions,
  WebSocketTransport,
  HttpTransport,
  Transport,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import * as chains from "viem/chains";
import { isWsEndpoint } from "../utils";

const UNKNOWN_CHAIN_CONFIG = {
  name: "Unknown",
  nativeCurrency: {
    name: "Unknown",
    symbol: "Unknown",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [],
    },
  },
};

export type SuperWalletClient = Client<
  Transport,
  Chain,
  Account,
  RpcSchema,
  PublicActions<Transport, Chain, Account> & WalletActions<Chain, Account>
>;

// Get the transport based on the endpoint
const getTransport = (endpoint: string): WebSocketTransport | HttpTransport =>
  isWsEndpoint(endpoint) ? webSocket(endpoint) : http(endpoint);

// Get the chain corresponding to the chainId. If the chain is not found, it will return
// an unknown chain which should work fine in most of the cases. We might need to update
// the viem package to support new chains if they don't work as expected with the unknown
// chain.
const getChainById = (chainId: number): Chain =>
  Object.values(chains).find((chain) => chain.id === chainId) ||
  defineChain({ id: chainId, ...UNKNOWN_CHAIN_CONFIG });

export const createClient = async (
  endpoint: string,
  mnemonic: string,
): Promise<SuperWalletClient> => {
  const transport = getTransport(endpoint);

  const chainId = await createPublicClient({
    transport,
  }).getChainId();

  return createWalletClient({
    transport,
    account: mnemonicToAccount(mnemonic),
    chain: getChainById(chainId),
  }).extend(publicActions);
};
