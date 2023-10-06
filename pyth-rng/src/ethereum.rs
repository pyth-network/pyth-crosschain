use ethabi::Function;
use reqwest::blocking::Client;
use serde_json::json;
use std::error::Error;

pub fn get_current_sequence() -> Result<usize, Box<dyn Error>> {
    let method: Function = serde_json::from_value(json! {
        {
            "type":            "function",
            "constant":        true,
            "inputs":          [],
            "name":            "nextSequenceNumber",
            "stateMutability": "view",
            "inputs": [
                {
                    "name": "provider",
                    "type": "address"
                },
            ],
            "outputs": [
                {
                    "name": "sequence",
                    "type": "uint64"
                }
            ],
        }
    })?;

    let inputs = vec![ethabi::Token::Address(
        std::env::var("PROVIDER_ADDRESS").unwrap().parse().unwrap(),
    )];

    let response = Client::new()
        .post(std::env::var("ETH_URL").unwrap())
        .json(&json! {
            {
                "jsonrpc": "2.0",
                "id":      1,
                "method":  "eth_call",
                "params": [
                    {
                        "to": std::env::var("CONTRACT_ADDRESS").unwrap(),
                        "data": "0x".to_owned() + hex::encode(
                            method.encode_input(&inputs).unwrap()
                        ).as_str(),
                    },
                    "latest",
                ],
                "id": 1,
                "jsonrpc": "2.0",
            }
        })
        .send()
        .unwrap()
        .json::<serde_json::Value>()
        .unwrap();

    let response = response.get("result").unwrap().as_str().unwrap();
    let response = usize::from_str_radix(&response[2..], 16).unwrap();

    Ok(response)
}
