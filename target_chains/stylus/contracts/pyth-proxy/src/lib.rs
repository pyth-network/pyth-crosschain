#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use alloc::vec::Vec;

use openzeppelin_stylus::proxy::IProxy;
use stylus_sdk::{alloy_primitives::Address, prelude::*, storage::StorageAddress, ArbResult};

#[entrypoint]
#[storage]
struct ProxyExample {
    implementation: StorageAddress,
}

#[public]
impl ProxyExample {
    #[constructor]
    pub fn constructor(&mut self, implementation: Address) {
        self.implementation.set(implementation);
    }

    fn implementation(&self) -> Result<Address, Vec<u8>> {
        IProxy::implementation(self)
    }

    #[fallback]
    fn fallback(&mut self, calldata: &[u8]) -> ArbResult {
        unsafe { self.do_fallback(calldata) }
    }
}

unsafe impl IProxy for ProxyExample {
    fn implementation(&self) -> Result<Address, Vec<u8>> {
        Ok(self.implementation.get())
    }
}

// #[macro_use]
// extern crate alloc;

// #[cfg(test)]
// mod end_to_end_proxy_tests;
// #[cfg(test)]
// mod proxy_integration_tests;

// use alloc::vec::Vec;

// use stylus_sdk::{alloy_primitives::Address, call::delegate_call, prelude::*};

// sol_storage! {
//     #[entrypoint]
//     pub struct Proxy {
//         bool is_initialized;
//         MetaInformation meta_information;
//     }

//     pub struct MetaInformation {
//         address owner;
//         address implementation_address;
//     }
// }

// #[public]
// impl Proxy {
//     pub fn init(&mut self, owner: Address) -> Result<(), Vec<u8>> {
//         if self.is_initialized.get() {
//             return Err(b"Already initialized".to_vec());
//         }
//         self.meta_information.owner.set(owner);
//         self.is_initialized.set(true);
//         Ok(())
//     }

//     pub fn get_implementation(&self) -> Result<Address, Vec<u8>> {
//         let addr = self.meta_information.implementation_address.get();
//         if addr == Address::ZERO {
//             return Err(b"Implementation not set".to_vec());
//         }
//         Ok(addr)
//     }

//     pub fn set_implementation(&mut self, implementation: Address) -> Result<(), Vec<u8>> {
//         self.only_owner()?;
//         if implementation == Address::ZERO {
//             return Err(b"Invalid implementation address".to_vec());
//         }
//         self.meta_information
//             .implementation_address
//             .set(implementation);
//         Ok(())
//     }

//     pub fn get_owner(&self) -> Address {
//         self.meta_information.owner.get()
//     }

//     pub fn is_initialized(&self) -> bool {
//         self.is_initialized.get()
//     }

//     #[payable]
//     pub fn relay_to_implementation(&mut self, data: Vec<u8>) -> Result<Vec<u8>, Vec<u8>> {
//         let implementation_address = self.get_implementation()?;
//         let res;
//         unsafe { res = delegate_call(self, implementation_address, &data[..]) };

//         match res {
//             Ok(res) => Ok(res.into()),
//             Err(e) => Err(format!("Delegate call failed: {:?}", e).into()),
//         }
//     }

//     fn only_owner(&self) -> Result<(), Vec<u8>> {
//         let owner = self.meta_information.owner.get();
//         if owner != self.vm().msg_sender() {
//             return Err(b"Unauthorized: not owner".to_vec());
//         }
//         Ok(())
//     }
// }
