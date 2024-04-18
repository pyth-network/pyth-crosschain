import logo from "./logo.svg";
import "./App.css";
import {
  AnchorWallet,
  ConnectionProvider,
  WalletProvider,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import {
  WalletDisconnectButton,
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import {
  PythSolanaReceiver,
  InstructionWithEphemeralSigners,
} from "@pythnetwork/pyth-solana-receiver";
import { Connection, PublicKey } from "@solana/web3.js";
import * as buffer from "buffer";
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import { MyFirstPythApp, IDL } from "./idl/my_first_pyth_app";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
window.Buffer = buffer.Buffer;

require("@solana/wallet-adapter-react-ui/styles.css");

const SOL_PRICE_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const ETH_PRICE_FEED_ID =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const BTC_PRICE_FEED_ID =
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
const BOBA_PRICE_FEED_ID =
  "0xd1e9cff9b8399f9867819a3bf1aa8c2598234eecfd36ddc3a7bc7848432184b5";
async function postPriceUpdate(connection: Connection, wallet?: AnchorWallet) {
  if (wallet === undefined) {
    return;
  } else {
    const priceServiceConnection = new PriceServiceConnection(
      "https://hermes.pyth.network/",
      { priceFeedRequestConfig: { binary: true } }
    );
    const pythSolanaReceiver = new PythSolanaReceiver({
      connection,
      wallet: wallet as Wallet,
    });

    const priceUpdateData = await priceServiceConnection.getVaa(
      SOL_PRICE_FEED_ID,
      1702285724
    );

    const myFirstApp = new Program<MyFirstPythApp>(
      IDL as MyFirstPythApp,
      new PublicKey("2e5gZD3suxgJgkCg4pkoogxDKszy1SAwokz8mNeZUj4M"),
      new AnchorProvider(connection, wallet, { commitment: "processed" })
    );

    const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
      closeUpdateAccounts: false,
    });
    await transactionBuilder.addPostPriceUpdates([priceUpdateData[0]]);

    await transactionBuilder.addPriceConsumerInstructions(
      async (
        getPriceUpdateAccount: (priceFeedId: string) => PublicKey
      ): Promise<InstructionWithEphemeralSigners[]> => {
        return [
          {
            instruction: await myFirstApp.methods
              .send(new BN(1))
              .accounts({
                destination: new PublicKey(
                  "BTwXQZS3EzfxBkv2A54estmn9YbmcpmRWeFP4f3avLi4"
                ),
                priceUpdate: getPriceUpdateAccount(SOL_PRICE_FEED_ID),
              })
              .instruction(),
            signers: [],
          },
        ];
      }
    );

    await pythSolanaReceiver.provider.sendAll(
      await transactionBuilder.buildVersionedTransactions({
        computeUnitPriceMicroLamports: 50000,
      }),
      { skipPreflight: true }
    );
  }
}

function Button() {
  const connection = new Connection("http://devnet.xyz.pyth.network");
  const wallet = useAnchorWallet();

  return (
    <button
      onClick={async () => {
          await postPriceUpdate(connection, wallet);
      }}
    >
      Send
    </button>
  );
}

function App() {
  return (
    <ConnectionProvider endpoint={"https://api.devnet.solana.com"}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <div className="App">
            <header className="App-header">
              <img src={logo} className="App-logo" alt="logo" />
              <WalletMultiButton />
              <WalletDisconnectButton />
              <p>Click to send a transaction to the Pyth Solana Receiver</p>
              <Button />
            </header>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;
