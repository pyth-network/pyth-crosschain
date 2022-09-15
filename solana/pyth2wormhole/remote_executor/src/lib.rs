// #![deny(warnings)]

use solitaire::solitaire;

mod api;
pub use api::{
    ExecuteVaa,
    execute_vaa,
};
mod error;
mod types;

solitaire! {
    ExecuteVaa => execute_vaa
}
