#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
#![cfg_attr(not(any(test, feature = "export-abi")), no_std)]

#[macro_use]
extern crate alloc;

use alloc::vec::Vec;

/// Import the Stylus SDK along with alloy primitive types for use in our program.
use stylus_sdk::{alloy_primitives::Address, call::delegate_call, msg, prelude::*};

sol_storage! {
    #[entrypoint]
    pub struct Proxy { 
        bool is_initialized;
        MetaInformation meta_information;
    }

    pub struct MetaInformation {
        address owner;
        address implementation_address;
    }

}

#[external]
impl Proxy {
    pub fn init(&mut self, owner: Address) -> Result<(), Vec<u8>> {
        if self.is_initialized.get() {
            return Err(format!("Already initialized").into());
        }
        self.meta_information.owner.set(owner);
        self.is_initialized.set(true);
        Ok(())
    }

    pub fn get_implementation(&self) -> Result<Address, Vec<u8>> {
        let addr = self.meta_information.implementation_address.get();
        Ok(addr)
    }

    pub fn set_implementation(&mut self, implementation: Address) -> Result<(), Vec<u8>> {
        self.only_owner()?;
        self.meta_information
            .implementation_address
            .set(implementation);
        Ok(())
    }

    pub fn relay_to_implementation(&mut self, data: Vec<u8>) -> Result<Vec<u8>, Vec<u8>> {
        let implementation_address = self.get_implementation()?;
        let res;
        unsafe {
            res = delegate_call(self, implementation_address, &data[..])
        };

        match res {
            Ok(res) => Ok(res.into()), 
            Err(e) => Err(format!("Error: {:?}", e).into()),
        }
    }
}

impl Proxy {
    pub fn only_owner(&mut self) -> Result<(), Vec<u8>> {
        let owner = self.meta_information.owner.get();
        if owner != msg::sender() {
            return Err(format!("Invalid").into());
        }
        Ok(())
    }
}