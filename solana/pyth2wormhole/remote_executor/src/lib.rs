#![deny(warnings)]

use solitaire::solitaire;

mod api;
pub use api::{
    ExecutePostedVaa,
    execute_posted_vaa,
};

solitaire! {
    ExecutePostedVaa => execute_posted_vaa
}
