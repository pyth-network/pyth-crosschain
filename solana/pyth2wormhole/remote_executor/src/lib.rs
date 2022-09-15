#![deny(warnings)]

use solitaire::solitaire;

mod api;
pub use api::{
    ExecuteVaa,
    execute_vaa,
};

solitaire! {
    ExecuteVaa => execute_vaa
}
