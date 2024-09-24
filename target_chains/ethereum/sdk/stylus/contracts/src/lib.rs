
#![allow(clippy::pub_underscore_fields, clippy::module_name_repetitions)]
#![cfg_attr(not(feature = "std"), no_std, no_main)]
#![deny(rustdoc::broken_intra_doc_links)]
extern crate alloc;

#[global_allocator]
static ALLOC: mini_alloc::MiniAlloc = mini_alloc::MiniAlloc::INIT;

pub mod  utils;
//pub mod  structs;
pub mod pyth;  

// pub mod mock;
