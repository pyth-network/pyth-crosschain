use {
    crate::{
        accumulator_input_seeds,
        MessageBufferError,
    },
    anchor_lang::prelude::*,
};

/// A MessageBuffer will have the following structure
/// ```ignore
/// struct MessageBuffer {
///     header: BufferHeader,
///     messages: [u8; accountInfo.data.len - header.header_len]
/// }
/// ```
///
/// where `MESSAGES_LEN` can be dynamic. There is actual
/// no messages field in the `MessageBuffer` struct definition due to messages
/// needing to be a dynamic length while supporting zero_copy
/// at the same time.
///
/// A `MessageBuffer` AccountInfo.data will look like:
/// [  <discrimintator>, <buffer_header>, <messages> ]
///         (0..8)       (8..header_len) (header_len...accountInfo.data.len)
#[account(zero_copy)]
#[derive(InitSpace, Debug)]
pub struct MessageBuffer {
    /* header */
    pub bump:        u8, // 1
    pub version:     u8, // 1
    // byte offset of accounts where data starts
    // e.g. account_info.data[offset + header_len]
    pub header_len:  u16, // 2
    /// endpoints of every message.
    /// ex: [10, 14]
    /// => msg1 = account_info.data[(header_len + 0)..(header_len + 10)]
    /// => msg2 = account_info.data[(header_len + 10)..(header_len + 14)]
    pub end_offsets: [u16; 255], // 510

                          /* messages */
                          //  not defined in struct since needs to support variable length
                          //  and work with zero_copy
                          // pub messages: [u8; accountInfo.data.len - header_len]
}


impl MessageBuffer {
    // HEADER_LEN allows for append-only forward-compatibility for the header.
    // this is the number of bytes from the beginning of the account_info.data
    // to the start of the `AccumulatorInput` data.
    pub const HEADER_LEN: u16 = 8 + MessageBuffer::INIT_SPACE as u16;

    pub const CURRENT_VERSION: u8 = 1;

    pub fn new(bump: u8) -> Self {
        Self {
            bump,
            header_len: Self::HEADER_LEN,
            version: Self::CURRENT_VERSION,
            end_offsets: [0u16; u8::MAX as usize],
        }
    }

    pub fn refresh_header(&mut self) {
        self.header_len = Self::HEADER_LEN;
        self.version = Self::CURRENT_VERSION;
        self.end_offsets = [0u16; u8::MAX as usize];
    }

    /// `put_all` writes all the messages to the `AccumulatorInput` account
    /// and updates the `end_offsets` array.
    ///
    /// TODO: the first byte of destination is the first non-header byte of the
    /// message buffer account
    ///
    /// Returns tuple of the number of messages written and the end_offset
    /// of the last message
    ///
    // TODO: add a end_offsets index parameter for "continuation"
    // TODO: test max size of parameters that can be passed into CPI call
    pub fn put_all_in_buffer(
        &mut self,
        destination: &mut [u8],
        values: &Vec<Vec<u8>>,
    ) -> (usize, u16) {
        let mut offset = 0u16;

        for (i, v) in values.iter().enumerate() {
            let start = offset;
            let len = u16::try_from(v.len());
            if len.is_err() {
                msg!("len err");
                return (i, start);
            }
            let end = offset.checked_add(len.unwrap());
            if end.is_none() {
                return (i, start);
            }
            let end = end.unwrap();
            if end > destination.len() as u16 {
                return (i, start);
            }
            self.end_offsets[i] = end;
            destination[(start as usize)..(end as usize)].copy_from_slice(v);
            offset = end
        }
        (values.len(), offset)
    }

    fn derive_pda(&self, cpi_caller: Pubkey, base_account: Pubkey) -> Result<Pubkey> {
        let res = Pubkey::create_program_address(
            accumulator_input_seeds!(self, cpi_caller, base_account),
            &crate::ID,
        )
        .map_err(|_| MessageBufferError::InvalidPDA)?;
        Ok(res)
    }

    pub fn validate(&self, key: Pubkey, cpi_caller: Pubkey, base_account: Pubkey) -> Result<()> {
        let expected_key = self.derive_pda(cpi_caller, base_account)?;
        require_keys_eq!(expected_key, key);
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use {
        super::*,
        anchor_lang::solana_program::keccak::hashv,
        bytemuck::{
            bytes_of,
            bytes_of_mut,
        },
        std::{
            io::Write,
            mem::{
                align_of,
                size_of,
            },
        },
    };

    fn data_bytes(data: Vec<u8>) -> Vec<u8> {
        let mut bytes = vec![];
        for d in data {
            bytes.extend_from_slice(&d.to_be_bytes());
        }
        bytes
    }

    fn sighash(namespace: &str, name: &str) -> [u8; 8] {
        let preimage = format!("{namespace}:{name}");

        let mut sighash = [0u8; 8];
        sighash.copy_from_slice(&hashv(&[preimage.as_bytes()]).to_bytes()[..8]);
        sighash
    }


    #[test]
    fn test_sizes_and_alignments() {
        let (message_buffer_size, message_buffer_align) =
            (size_of::<MessageBuffer>(), align_of::<MessageBuffer>());

        assert_eq!(message_buffer_size, 514);
        assert_eq!(message_buffer_align, 2);
    }

    #[test]
    fn test_put_all() {
        let data = vec![vec![12, 34], vec![56, 78, 90]];
        let data_bytes: Vec<Vec<u8>> = data.into_iter().map(data_bytes).collect();

        let message_buffer = &mut MessageBuffer::new(0);
        let header_len = message_buffer.header_len as usize;
        let message_buffer_bytes = bytes_of_mut(message_buffer);
        // assuming account_info.data.len() == 10KB
        let messages = &mut vec![0u8; 10_240 - header_len];

        let account_info_data = &mut vec![];
        let discriminator = &mut sighash("accounts", "MessageBuffer");
        account_info_data.write_all(discriminator).unwrap();
        account_info_data.write_all(message_buffer_bytes).unwrap();
        account_info_data
            .write_all(messages.as_mut_slice())
            .unwrap();

        let account_data_len = account_info_data.len();

        let destination = &mut account_info_data[(message_buffer.header_len as usize)..];

        let (num_msgs, num_bytes) = message_buffer.put_all_in_buffer(destination, &data_bytes);

        assert_eq!(num_msgs, 2);
        assert_eq!(num_bytes, 5);


        assert_eq!(message_buffer.end_offsets[0], 2);
        assert_eq!(message_buffer.end_offsets[1], 5);


        // let account_data = bytes_of(accumulator_input);


        // // The header_len field represents the size of all data prior to the message bytes.
        // // This includes the account discriminator, which is not part of the header struct.
        // // Subtract the size of the discriminator (8 bytes) to compensate
        // let header_len = message_buffer.header_len as usize - 8;
        let header_len = message_buffer.header_len as usize;


        let iter = message_buffer.end_offsets.iter().take_while(|x| **x != 0);
        let mut start = header_len;
        let mut data_iter = data_bytes.iter();
        for offset in iter {
            let end_offset = header_len + *offset as usize;
            let message_buffer_data = &account_info_data[start..end_offset];
            let expected_data = data_iter.next().unwrap();
            assert_eq!(message_buffer_data, expected_data.as_slice());
            start = end_offset;
        }
    }

    #[test]
    fn test_put_all_exceed_max() {
        let data = vec![vec![0u8; 9_718 - 2], vec![0u8], vec![0u8; 2]];

        let data_bytes: Vec<Vec<u8>> = data.into_iter().map(data_bytes).collect();

        let message_buffer = &mut MessageBuffer::new(0);
        let header_len = message_buffer.header_len as usize;
        let message_buffer_bytes = bytes_of_mut(message_buffer);
        // assuming account_info.data.len() == 10KB
        let messages = &mut vec![0u8; 10_240 - header_len];

        let account_info_data = &mut vec![];
        let discriminator = &mut sighash("accounts", "MessageBuffer");
        account_info_data.write_all(discriminator).unwrap();
        account_info_data.write_all(message_buffer_bytes).unwrap();
        account_info_data
            .write_all(messages.as_mut_slice())
            .unwrap();

        let account_data_len = account_info_data.len();

        let destination = &mut account_info_data[(message_buffer.header_len as usize)..];

        let (num_msgs, num_bytes) = message_buffer.put_all_in_buffer(destination, &data_bytes);

        assert_eq!(num_msgs, 2);
        assert_eq!(
            num_bytes,
            data_bytes[0..2].iter().map(|x| x.len()).sum::<usize>() as u16
        );


        let iter = message_buffer.end_offsets.iter().take_while(|x| **x != 0);
        let mut start = header_len;
        let mut data_iter = data_bytes.iter();
        for offset in iter {
            let end_offset = header_len + *offset as usize;
            let message_buffer_data = &account_info_data[start..end_offset];
            let expected_data = data_iter.next().unwrap();
            assert_eq!(message_buffer_data, expected_data.as_slice());
            start = end_offset;
        }

        assert_eq!(message_buffer.end_offsets[2], 0);
    }
    //
    #[test]
    fn test_put_all_long_vec() {
        let data = vec![
            vec![0u8; 9_718 - 3],
            vec![0u8],
            vec![0u8],
            vec![0u8; u16::MAX as usize + 2],
            vec![0u8],
        ];

        let data_bytes: Vec<Vec<u8>> = data.into_iter().map(data_bytes).collect();
        // let message_buffer = &mut MessageBufferTemp::new(0);
        // let (num_msgs, num_bytes) = message_buffer.put_all(&data_bytes);

        let message_buffer = &mut MessageBuffer::new(0);
        let header_len = message_buffer.header_len as usize;

        let message_buffer_bytes = bytes_of_mut(message_buffer);
        // assuming account_info.data.len() == 10KB
        let messages = &mut vec![0u8; 10_240 - header_len];

        let account_info_data = &mut vec![];
        let discriminator = &mut sighash("accounts", "MessageBuffer");
        account_info_data.write_all(discriminator).unwrap();
        account_info_data.write_all(message_buffer_bytes).unwrap();
        account_info_data
            .write_all(messages.as_mut_slice())
            .unwrap();

        let account_data_len = account_info_data.len();

        let destination = &mut account_info_data[(message_buffer.header_len as usize)..];

        let (num_msgs, num_bytes) = message_buffer.put_all_in_buffer(destination, &data_bytes);

        assert_eq!(num_msgs, 3);
        assert_eq!(
            num_bytes,
            data_bytes[0..3].iter().map(|x| x.len()).sum::<usize>() as u16
        );


        let iter = message_buffer.end_offsets.iter().take_while(|x| **x != 0);
        let mut start = header_len;
        let mut data_iter = data_bytes.iter();
        for offset in iter {
            let end_offset = header_len + *offset as usize;
            let message_buffer_data = &account_info_data[start..end_offset];
            let expected_data = data_iter.next().unwrap();
            assert_eq!(message_buffer_data, expected_data.as_slice());
            start = end_offset;
        }

        assert_eq!(message_buffer.end_offsets[0], 9_715);
        assert_eq!(message_buffer.end_offsets[1], 9_716);
        assert_eq!(message_buffer.end_offsets[2], 9_717);
        assert_eq!(message_buffer.end_offsets[3], 0);
        assert_eq!(message_buffer.end_offsets[4], 0);
    }
}
