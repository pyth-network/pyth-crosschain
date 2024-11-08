use {
    crate::{
        instructions::{UpdatePrice, UpdatePriceParams},
        message::{price::DummyPriceMessage, AccumulatorSerializer},
    },
    anchor_lang::prelude::*,
};

pub fn cpi_max_test<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdatePrice<'info>>,
    params: UpdatePriceParams,
    msg_sizes: Vec<u16>,
) -> Result<()> {
    let mut inputs = vec![];

    {
        let pyth_price_acct = &mut ctx.accounts.pyth_price_account.load_mut()?;
        pyth_price_acct.update(params)?;

        for msg_size in msg_sizes {
            let price_dummy_data = DummyPriceMessage::new(msg_size).accumulator_serialize()?;
            inputs.push(price_dummy_data);
        }
    }

    let input_len = inputs.iter().map(|x| x.len()).sum::<usize>();
    msg!("input_len: {}", input_len);

    UpdatePrice::emit_messages(ctx, inputs)
}
