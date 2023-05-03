use super::*;

#[tokio::test]
async fn test_set_allowed_programs() {
    let pt_ctxt = &mut setup_program_test(false).await;

    // Initialize whitelist

    let banks_client = &mut pt_ctxt.banks_client;
    let payer = &pt_ctxt.payer;
    let (whitelist_pda, whitelist_bump) =
        send_initialize_whitelist(banks_client, payer.pubkey(), payer)
            .await
            .unwrap();

    let (whitelist_acct_bump, admin_pubkey, allowed_programs_len, allowed_programs) =
        fetch_whitelist(banks_client, &whitelist_pda).await;

    assert_eq!(whitelist_bump, whitelist_acct_bump);
    assert_eq!(payer.pubkey(), admin_pubkey);

    assert_eq!(0, allowed_programs_len);
    assert_eq!(allowed_programs, vec![]);

    // Add MockCpiProgram auth pda to allowed programs
    let mock_cpi_caller_auth = get_mock_cpi_auth();


    let allowed_programs = vec![mock_cpi_caller_auth];
    send_set_allowed_programs(banks_client, payer, &whitelist_pda, &allowed_programs)
        .await
        .unwrap();

    let (_, _, allowed_programs_len, updated_allowed_programs) =
        fetch_whitelist(banks_client, &whitelist_pda).await;

    assert_eq!(1, allowed_programs_len);
    assert_eq!(allowed_programs, updated_allowed_programs);
}
