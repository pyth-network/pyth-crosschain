pub mod transaction {
    pub use crate::protobuf::pyth_lazer_transaction::*;
}

mod protobuf {
    include!(concat!(env!("OUT_DIR"), "/protobuf/mod.rs"));
}
