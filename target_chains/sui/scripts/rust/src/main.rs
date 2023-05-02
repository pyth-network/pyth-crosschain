#![allow(unused_imports)]
#![allow(unused_variables)]
#![allow(dead_code)]

mod programmable;

use dirs;
use fastcrypto::{encoding::Base64, hash::HashFunction};
use futures::StreamExt;
use shared_crypto::intent::Intent;
use std::env;
use std::str::FromStr;
use sui_json::call_args;
use sui_json::type_args;
use sui_json_rpc_types::SuiTransactionBlockEffects;
use sui_json_rpc_types::SuiTypeTag;
use sui_keys::keystore::{AccountKeystore, FileBasedKeystore, Keystore};
use sui_sdk::json::SuiJsonValue;
use sui_sdk::rpc_types::{
    EventFilter, SuiObjectDataOptions, SuiObjectResponse, SuiTransactionBlockResponseOptions,
    SuiTransactionBlockResponseQuery,
};
use sui_sdk::types::base_types::{ObjectID, SuiAddress};
use sui_sdk::types::messages::{
    ExecuteTransactionRequestType, GasData, ProgrammableTransaction, Transaction, TransactionData,
    TransactionDataV1, TransactionExpiration, TransactionKind,
};
use sui_sdk::{SuiClient, SuiClientBuilder};
use sui_types::digests::TransactionDigest;
use sui_types::query::TransactionFilter;

use crate::programmable::*;

async fn get_object(sui: &SuiClient, object_id: ObjectID) -> anyhow::Result<()> {
    println!("!!! get_single_object:");
    let options = SuiObjectDataOptions {
        show_type: false,
        show_owner: false,
        show_previous_transaction: false,
        show_display: false,
        show_content: false,
        show_bcs: true,
        show_storage_rebate: false,
    };
    let object = sui
        .read_api()
        .get_object_with_options(object_id, options)
        .await?;
    println!("{:#?}", object.data);
    println!("======================");
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let argv: Vec<String> = env::args().collect();

    // In Rust, WS and HTTTP endpoints need to be specified separately.
    let sui = SuiClientBuilder::default()
        //.ws_url("ws://127.0.0.1:9000") // localnet
        //.ws_url("wss://fullnode.devnet.sui.io:443") // devnet
        .ws_url("wss://fullnode.testnet.sui.io:443") // testnet
        //.build("http://127.0.0.1:9000") // localnet
        // .build("http://127.0.0.1:3000") // "proxynet" (Run  httpproxy/main.go for this to work)
        // .build("https://fullnode.devnet.sui.io:443") // devnet
         .build("https://fullnode.testnet.sui.io:443") // testnet
        .await
        .unwrap();
    let my_address1 =
        SuiAddress::from_str("0x8c09dd5350d8e1d13d1a36ba4e8cfb5b3382f47d5545455310ef8ec180e76af7")?;
    let my_address1_gas_object =
        ObjectID::from_str("0x088ed2dbb8cf2c6da083bff5c46c7b55a2c235361cadd63a7bbb01f7ffe2ee20")?;
    let my_address2 =
        SuiAddress::from_str("0x4ed01b6abcc271a5c7a1e05ee9344d6eb72d0c1f2483a1c600b46d73a22ba764")?;

    if argv.contains(&String::from("--objects")) {
        get_owned_objects(&sui, my_address1).await?;
    } else {
        println!("!!! skipping objects since --objects was not provided");
    }

    if argv.contains(&String::from("--get-object")) {
        let some_object = ObjectID::from_str(
            "0x35a0d5a868ca3612822045985cbb869354fa10b389e1816d065ebd2909cab6e8",
        )?;
        get_object(&sui, some_object).await?;
    } else {
        println!("!!! skipping get-object since --get-object was not provided");
    }

    if argv.contains(&String::from("--get-transaction")) {
        let interesting_transaction =
            TransactionDigest::from_str("8iEbjTWv8Hj5WZiTncJm2rMRJoJoQLRtGkDAXX4mBaAF")?;
        get_transaction(&sui, interesting_transaction).await?;
    } else {
        println!("!!! skipping get-transaction since --get-transaction was not provided");
    }

    if argv.contains(&String::from("--my-transactions")) {
        query_my_transactions(&sui, my_address1).await?;
    } else {
        println!("!!! skipping my transactions since --my-transactions was not provided");
    }

    if argv.contains(&String::from("--transfer")) {
        make_sui_transfer(&sui, my_address1, my_address1_gas_object, my_address2).await?;
    } else {
        println!("!!! skipping transfer since --transfer was not provided");
    }

    if argv.contains(&String::from("--events")) {
        // This address has called the 8192 game on testnet.
        let some_address = SuiAddress::from_str(
            "0xdd6dca6d248a48bc6591edce1754ecb78f793c1c963aebc28ed7b26aaea99198",
        )?;
        query_events(&sui, some_address).await?;
    } else {
        println!("!!! skipping transfer since --events was not provided");
    }

    if argv.contains(&String::from("--move")) {
        call_move_function(&sui).await?;
    } else {
        println!("!!! skipping move call since --move was not provided");
    }

    if argv.contains(&String::from("--programmable")) {
        call_programmable_transaction(&sui).await?;
    } else {
        println!(
            "!!! skipping programmable transaction call since --programmable was not provided"
        );
    }

    if argv.contains(&String::from("--subscribe")) {
        println!("!!! subscribing to events:");
        let mut subscribe_all = sui
            .event_api()
            .subscribe_event(EventFilter::All(vec![]))
            .await?;
        loop {
            let next = subscribe_all.next().await;
            println!("{:?}", next);
            if next.is_none() {
                break;
            }
        }
    } else {
        println!("!!! skipping subscribing to events since --subscribe was not provided");
    }

    Ok(())
}
