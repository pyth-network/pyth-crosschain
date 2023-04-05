#[macro_export]
macro_rules! accumulator_input_seeds {
    ($accumulator_input:expr, $cpi_caller_pid:expr, $base_account:expr) => {
        &[
            $cpi_caller_pid.as_ref(),
            b"accumulator".as_ref(),
            $base_account.as_ref(),
            &$accumulator_input.header.account_schema.to_le_bytes(),
            &[$accumulator_input.header.bump],
        ]
    };
}
