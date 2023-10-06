#![allow(clippy::just_underscores_and_digits)]

use byteorder::BE;
use state::Tree;
use std::error::Error;

mod api;
mod ethereum;
mod state;

const SECRET: &str = "secret";

fn main() -> Result<(), Box<dyn Error>> {
    // Initialize Program State.
    let state = Tree::new(SECRET, 0, 1_000_000);

    // Consume some random numbers for debugging.
    (0..5).for_each(|i| {
        let proof = api::get_randomness_proof(&state, i).unwrap();
        let serialized = pythnet_sdk::wire::to_vec::<_, BE>(&proof).unwrap();
        println!("Proof: {:?}", serialized)
    });

    ethereum::get_current_sequence()?;

    Ok(())
}
