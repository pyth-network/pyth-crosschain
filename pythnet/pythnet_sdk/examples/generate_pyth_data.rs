// Use the Solana client library to pull the addresses of all relevant accounts from PythNet so we
// can test locally.

use {
    pythnet_sdk::pythnet::PYTH_PID,
    serde_json::json,
    solana_client::rpc_client::RpcClient,
    solana_sdk::pubkey::Pubkey,
    std::{io::Write, str::FromStr},
};

fn main() {
    let client = RpcClient::new("http://pythnet.rpcpool.com/".to_string());
    let pythnet = Pubkey::from_str("FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH").unwrap();
    let wormhole = Pubkey::from_str("H3fxXJ86ADW2PNuDDmZJg6mzTtPxkYCpNuQUTgmJ7AjU").unwrap();

    // Create a folder called `accounts` in the current directory, if it already exists that is OK
    // but only if the folder is empty.
    std::fs::create_dir_all("accounts").unwrap();

    // Download all PythNet accounts into .json files in the current directory.
    {
        let pythnet_accounts = client.get_program_accounts(&pythnet).map_err(|e| {
            println!("{e}");
            e
        });

        pythnet_accounts
            .unwrap()
            .into_iter()
            .for_each(|(pubkey, _account)| {
                // This writes the account as JSON into a file that solana-test-validator can read into
                // the ledger. Each account should be written into a file named `<pubkey>.json`
                let account = client.get_account(&pubkey).unwrap();

                // Now write to <pubkey>.json.
                std::fs::write(
                    format!("accounts/{pubkey}.json"),
                    json!({
                        "pubkey": pubkey.to_string(),
                        "account": {
                            "lamports": account.lamports,
                            "data": [
                                base64::encode(&account.data),
                                "base64"
                            ],
                            "owner": account.owner.to_string(),
                            "executable": account.executable,
                            "rentEpoch": account.rent_epoch,
                        }
                    })
                    .to_string(),
                )
                .unwrap();
            });
    }

    // Download the Wormhole program only into a .json file in the current directory. Instead of
    // getting the program accounts we just want the wormhole one itself.
    {
        let wormhole_account = client.get_account(&wormhole).unwrap();

        // Now write to wormhole.json.
        std::fs::write(
            format!("accounts/{wormhole}.json"),
            json!({
                "pubkey": wormhole.to_string(),
                "account": {
                    "lamports": wormhole_account.lamports,
                    "data": [
                        base64::encode(&wormhole_account.data),
                        "base64"
                    ],
                    "owner": wormhole_account.owner.to_string(),
                    "executable": wormhole_account.executable,
                    "rentEpoch": wormhole_account.rent_epoch,
                }
            })
            .to_string(),
        )
        .unwrap();
    }

    // Same for the Pyth program.
    {
        let pyth_account = client.get_account(&pythnet).unwrap();

        // Now write to pyth.json.
        std::fs::write(
            format!("accounts/{pythnet}.json"),
            json!({
                "pubkey": pythnet.to_string(),
                "account": {
                    "lamports": pyth_account.lamports,
                    "data": [
                        base64::encode(&pyth_account.data),
                        "base64"
                    ],
                    "owner": pyth_account.owner.to_string(),
                    "executable": pyth_account.executable,
                    "rentEpoch": pyth_account.rent_epoch,
                }
            })
            .to_string(),
        )
        .unwrap();
    }

    // Write names of AccumulatorState accounts to pdas.txt
    {
        let mut file = std::fs::File::create("pdas.txt").unwrap();
        for i in (0..10_000u32) {
            let (accumulator_account, _) = Pubkey::find_program_address(
                &[b"AccumulatorState", &PYTH_PID, &i.to_be_bytes()],
                &solana_sdk::system_program::id(),
            );
            file.write_all(format!("{}\n", accumulator_account).as_bytes())
                .unwrap();
        }
    }
}
