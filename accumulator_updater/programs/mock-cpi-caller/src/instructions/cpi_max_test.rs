use {
    crate::{
        instructions::{
            UpdatePrice,
            UpdatePriceParams,
        },
        message::{
            get_schemas,
            price::{
                CompactPriceMessage,
                DummyPriceMessage,
                FullPriceMessage,
            },
            AccumulatorSerializer,
        },
        state::PythAccountType,
    },
    anchor_lang::prelude::*,
};

pub fn cpi_max_test<'info>(
    ctx: Context<'_, '_, '_, 'info, UpdatePrice<'info>>,
    params: UpdatePriceParams,
    num_messages: u8,
) -> Result<()> {
    let mut inputs = vec![];
    let _schemas = get_schemas(PythAccountType::Price);

    {
        let pyth_price_acct = &mut ctx.accounts.pyth_price_account.load_mut()?;
        pyth_price_acct.update(params)?;

        let price_full_data = FullPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;

        inputs.push(price_full_data);


        let price_compact_data =
            CompactPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;
        inputs.push(price_compact_data);

        for _ in 0..num_messages {
            let price_dummy_data =
                DummyPriceMessage::from(&**pyth_price_acct).accumulator_serialize()?;
            inputs.push(price_dummy_data);
        }
    }

    let input_len = inputs.iter().map(|x| x.len()).sum::<usize>();
    msg!("input_len: {}", input_len);


    UpdatePrice::emit_accumulator_inputs(ctx, inputs)
}
