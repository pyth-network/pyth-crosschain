use {
    super::Instruction,
    crate::{Account, GuardianSet},
    borsh::{BorshDeserialize, BorshSerialize},
    byteorder::{LittleEndian, WriteBytesExt},
    serde_wormhole::RawMessage,
    solana_program::{
        instruction::{AccountMeta, Instruction as SolanaInstruction},
        pubkey::Pubkey,
        sysvar,
    },
    std::io::Write,
    wormhole_sdk::vaa::{Body, Header, Vaa},
};

pub fn verify_signatures(
    program_id: Pubkey,
    payer: Pubkey,
    guardian_set_index: u32,
    signature_set: Pubkey,
    data: VerifySignaturesData,
) -> Result<SolanaInstruction, serde_wormhole::Error> {
    let guardian_set = GuardianSet::key(&program_id, guardian_set_index);

    Ok(SolanaInstruction {
        program_id,

        accounts: vec![
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(guardian_set, false),
            AccountMeta::new(signature_set, true),
            AccountMeta::new_readonly(sysvar::instructions::id(), false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
        ],

        data: (Instruction::VerifySignatures, data).try_to_vec()?,
    })
}

pub struct SignatureItem {
    pub signature: Vec<u8>,
    pub key: [u8; 20],
    pub index: u8,
}

#[derive(Default, BorshSerialize, BorshDeserialize)]
pub struct VerifySignaturesData {
    /// instruction indices of signers (-1 for missing)
    pub signers: [i8; 19],
}

pub fn verify_signatures_txs(
    vaa_data: &[u8],
    guardian_set: GuardianSet,
    program_id: Pubkey,
    payer: Pubkey,
    guardian_set_index: u32,
    signature_set: Pubkey,
) -> Result<Vec<Vec<SolanaInstruction>>, serde_wormhole::Error> {
    let vaa: Vaa<&RawMessage> = serde_wormhole::from_slice(vaa_data)?;

    let mut signature_items: Vec<SignatureItem> = Vec::new();
    for s in vaa.signatures.iter() {
        let mut item = SignatureItem {
            signature: s.signature.to_vec(),
            key: [0; 20],
            index: s.index,
        };
        item.key = guardian_set.keys[s.index as usize];

        signature_items.push(item);
    }

    let (_, body): (Header, Body<&RawMessage>) = vaa.into();
    let vaa_hash = body.digest().unwrap().hash;
    let mut verify_txs: Vec<Vec<SolanaInstruction>> = Vec::new();

    for chunk in signature_items.chunks(7) {
        let mut secp_payload = Vec::new();
        let mut signature_status = [-1i8; 19];

        let data_offset = 1 + chunk.len() * 11;
        let message_offset = data_offset + chunk.len() * 85;

        // 1 number of signatures
        secp_payload.write_u8(chunk.len() as u8)?;

        // Secp signature info description (11 bytes * n)
        for (i, s) in chunk.iter().enumerate() {
            secp_payload.write_u16::<LittleEndian>((data_offset + 85 * i) as u16)?;
            secp_payload.write_u8(0)?;
            secp_payload.write_u16::<LittleEndian>((data_offset + 85 * i + 65) as u16)?;
            secp_payload.write_u8(0)?;
            secp_payload.write_u16::<LittleEndian>(message_offset as u16)?;
            secp_payload.write_u16::<LittleEndian>(vaa_hash.len() as u16)?;
            secp_payload.write_u8(0)?;
            signature_status[s.index as usize] = i as i8;
        }

        // Write signatures and addresses
        for s in chunk.iter() {
            secp_payload.write_all(&s.signature)?;
            secp_payload.write_all(&s.key)?;
        }

        // Write body
        secp_payload.write_all(&vaa_hash)?;

        let secp_ix = SolanaInstruction {
            program_id: solana_program::secp256k1_program::id(),
            data: secp_payload,
            accounts: vec![],
        };

        let payload = VerifySignaturesData {
            signers: signature_status,
        };

        let verify_ix = match verify_signatures(
            program_id,
            payer,
            guardian_set_index,
            signature_set,
            payload,
        ) {
            Ok(v) => v,
            Err(e) => panic!("{e:?}"),
        };

        verify_txs.push(vec![secp_ix, verify_ix])
    }
    Ok(verify_txs)
}
