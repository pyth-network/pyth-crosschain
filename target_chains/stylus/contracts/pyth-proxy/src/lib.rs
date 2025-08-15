#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use alloc::vec::Vec;

use openzeppelin_stylus::{
    access::ownable::IOwnable,
    proxy::beacon::{
        upgradeable::{self, IUpgradeableBeacon, UpgradeableBeacon},
        IBeacon,
    },
};
use stylus_sdk::{alloy_primitives::Address, prelude::*};

#[entrypoint]
#[storage]
struct PythProxy {
    upgradeable_beacon: UpgradeableBeacon,
}

#[public]
#[implements(IUpgradeableBeacon, IOwnable, IBeacon)]
impl PythProxy {
    #[constructor]
    pub fn constructor(
        &mut self,
        implementation: Address,
        initial_owner: Address,
    ) -> Result<(), upgradeable::Error> {
        self.upgradeable_beacon.constructor(implementation, initial_owner)
    }
}

#[public]
impl IUpgradeableBeacon for PythProxy {
    fn upgrade_to(
        &mut self,
        new_implementation: Address,
    ) -> Result<(), Vec<u8>> {
        Ok(self.upgradeable_beacon.upgrade_to(new_implementation)?)
    }
}

#[public]
impl IBeacon for PythProxy {
    fn implementation(&self) -> Result<Address, Vec<u8>> {
        self.upgradeable_beacon.implementation()
    }
}

#[public]
impl IOwnable for PythProxy {
    fn owner(&self) -> Address {
        self.upgradeable_beacon.owner()
    }

    fn transfer_ownership(
        &mut self,
        new_owner: Address,
    ) -> Result<(), Vec<u8>> {
        self.upgradeable_beacon.transfer_ownership(new_owner)
    }

    fn renounce_ownership(&mut self) -> Result<(), Vec<u8>> {
        self.upgradeable_beacon.renounce_ownership()
    }
}