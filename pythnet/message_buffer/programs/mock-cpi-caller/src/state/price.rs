use {
    crate::{
        instructions::{AddPriceParams, UpdatePriceParams},
        state::{PythAccount, PythAccountType},
    },
    anchor_lang::prelude::*,
};

#[account(zero_copy)]
#[derive(InitSpace)]
pub struct PriceAccount {
    pub id: u64,
    pub price: u64,
    pub price_expo: u64,
    pub ema: u64,
    pub ema_expo: u64,
    pub comp_: [Pubkey; 32],
}

impl PriceAccount {
    pub(crate) fn init(&mut self, params: AddPriceParams) -> Result<()> {
        self.id = params.id;
        self.price = params.price;
        self.price_expo = params.price_expo;
        self.ema = params.ema;
        self.ema_expo = params.ema_expo;
        Ok(())
    }

    pub(crate) fn update(&mut self, params: UpdatePriceParams) -> Result<()> {
        self.price = params.price;
        self.price_expo = params.price_expo;
        self.ema = params.ema;
        self.ema_expo = params.ema_expo;
        Ok(())
    }
}

impl PythAccount for PriceAccount {
    const ACCOUNT_TYPE: PythAccountType = PythAccountType::Price;
}
