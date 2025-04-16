pub mod transaction {
    pub use crate::protobuf::pyth_lazer_transaction::*;
}

pub mod publisher_update {
    pub use crate::protobuf::publisher_update::*;
}

mod protobuf {
    include!(concat!(env!("OUT_DIR"), "/protobuf/mod.rs"));
}
