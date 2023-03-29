#[macro_export]
macro_rules! accumulator_acc_seeds {
    ($cpi_caller_pid:expr, $base_account:expr, $account_type:expr) => {
        &[
            $cpi_caller_pid.as_ref(),
            b"accumulator".as_ref(),
            $base_account.as_ref(),
            &$account_type.to_le_bytes(),
        ]
    };
}


#[macro_export]
macro_rules! accumulator_acc_seeds_with_bump {
    ($cpi_caller_pid:expr, $base_account:expr, $account_type:expr, $bump:expr) => {
        &[
            $cpi_caller_pid.as_ref(),
            b"accumulator".as_ref(),
            $base_account.as_ref(),
            &$account_type.to_le_bytes(),
            &[$bump],
        ]
    };
}
