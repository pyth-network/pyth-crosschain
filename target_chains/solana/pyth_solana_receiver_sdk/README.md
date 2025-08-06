# Pyth Solana Receiver Rust SDK

This is a Rust SDK to build Solana programs that consume Pyth price updates posted by the Pyth Solana Receiver.

It is available on [crates.io](https://crates.io/crates/pyth-solana-receiver-sdk).

## Pull model

The Pyth Solana Receiver allows users to consume Pyth price updates on a pull basis. This means that the user is responsible for submitting the price data on-chain whenever they want to interact with an app that requires a price update.

Price updates get posted into price update accounts, owned by the Receiver contract. Once an update has been posted to a price update account, it can be used by anyone by simply passing the price update account as one of the accounts in a Solana instruction.
Price update accounts can be closed by whoever wrote them to recover the rent.

## Warning

When using price update accounts, you should check that the accounts are owned by the Pyth Solana Receiver contract to avoid impersonation attacks. This SDK checks this if you use Anchor's `Account` struct (ex: `Account<'info, PriceUpdateV2>`).

You should also check the `verification_level` of the account. Read more about this [here](./src/price_update.rs) in the documentation for `VerificationLevel`.

## Example use

A Solana program can consume price update accounts created by the Pyth Solana Receiver using this SDK:

```rust

use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

declare_id!("2UA3M6dSJQjrfTdzAiL2vMvubWoch1nTXK5TRaNGuiY4");

#[derive(Accounts)]
#[instruction(id:String)]
pub struct Sample<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    // Add this account to any instruction Context that needs price data.
    pub price_update: Account<'info, PriceUpdateV2>,
}

#[program]
pub mod pyth_oracle_1 {

    use super::*;

    pub fn sample(ctx: Context<Sample>, id: String) -> Result<()> {
        let price_update = &mut ctx.accounts.price_update;
        let maximum_age: u64 = 30;
        let feed_id: [u8; 32] = get_feed_id_from_hex(&id)?;
        let price = price_update.get_price_no_older_than(&Clock::get()?, maximum_age, &feed_id)?;

        msg!(
            "The price is ({} ± {}) * 10^{}",
            price.price,
            price.conf,
            price.exponent
        );
        Ok(())
    }
}

```
## Test
To test this contract :

```typescript

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PythOracle1 } from "../target/types/pyth_oracle_1";
import {
  PythSolanaReceiver,
  InstructionWithEphemeralSigners,
} from "@pythnetwork/pyth-solana-receiver";
import * as buffer from "buffer";
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";
import { Transaction } from "@solana/web3.js";
const { SystemProgram, Keypair, Connection, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const SOL_PRICE_FEED_ID = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"; //BTC/USD
const HERMES_URL = "https://hermes.pyth.network/";
const DEVNET_RPC_URL = "https://api.devnet.solana.com";
const connection = new Connection(DEVNET_RPC_URL);
const provider = anchor.AnchorProvider.env()
const wallet = anchor.web3.Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync("PATH_TO_WALLET", 'utf8'))));

describe("pyth_oracle_1", () => {

  anchor.setProvider(provider);

  const program = anchor.workspace.PythOracle1 as Program<PythOracle1>;

  it("Is initialized!", async () => {
    const priceServiceConnection = new PriceServiceConnection(HERMES_URL, {
      priceFeedRequestConfig: { binary: true },
    });

    const pythSolanaReceiver = new PythSolanaReceiver({
      connection: connection,
      wallet: new Wallet(wallet),
    });
    const priceUpdateData = await priceServiceConnection.getLatestVaas([SOL_PRICE_FEED_ID]);

    // Build transaction
    const transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
      closeUpdateAccounts: true,
    });
    await transactionBuilder.addPostPriceUpdates([priceUpdateData[0]]);

    await transactionBuilder.addPriceConsumerInstructions(
      async (getPriceUpdateAccount: (priceFeedId: string) => typeof PublicKey): Promise<InstructionWithEphemeralSigners[]> => {
        return [{
          instruction: await program.methods
            .sample(SOL_PRICE_FEED_ID) // Replace with your actual method and parameters
            .accounts({
              payer: wallet.publicKey,
              priceUpdate: getPriceUpdateAccount(SOL_PRICE_FEED_ID),
              // Add other required accounts here
            })
            .instruction(),
          signers: [],
        }];
      }
    );

    const txs = await pythSolanaReceiver.provider.sendAll(
      await transactionBuilder.buildVersionedTransactions({
        computeUnitPriceMicroLamports: 50000,
      }),
      { skipPreflight: true }
    );
    for (const signature of txs) {
      try {
        const tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 }, { commitment: 'confirmed' });

        if (tx && tx.meta && tx.meta.logMessages) {
          console.log("Transaction logs:", tx.meta.logMessages);
        } else {
          console.log(" Solana Explorer:");
          console.log(`https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        }
      } catch (error) {
        console.error("Error fetching transaction logs for signature:", signature, error);
      }
    }


  });
});

```
