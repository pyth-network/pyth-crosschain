use {
    crate::{
        accumulator_input_seeds,
        AccumulatorUpdaterError,
    },
    anchor_lang::prelude::*,
};

#[account(zero_copy)]
#[derive(InitSpace, Debug)]
pub struct BufferHeader {
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
}


impl BufferHeader {
    // HEADER_LEN allows for append-only forward-compatibility for the header.
    // this is the number of bytes from the beginning of the account_info.data
    // to the start of the `AccumulatorInput` data.
    pub const HEADER_LEN: u16 = 8 + BufferHeader::INIT_SPACE as u16;

    pub const CURRENT_VERSION: u8 = 1;

    pub fn new(bump: u8) -> Self {
        Self {
            bump,
            header_len: Self::HEADER_LEN,
            version: Self::CURRENT_VERSION,
            end_offsets: [0u16; u8::MAX as usize],
        }
    }

    pub fn refresh(&mut self) {
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
        .map_err(|_| AccumulatorUpdaterError::InvalidPDA)?;
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
        bytemuck::bytes_of,
        std::mem::{
            align_of,
            size_of,
        },
    };

    fn data_bytes(data: Vec<u8>) -> Vec<u8> {
        let mut bytes = vec![];
        for d in data {
            bytes.extend_from_slice(&d.to_be_bytes());
        }
        bytes
    }


    #[test]
    fn test_sizes_and_alignments() {
        let (header_idx_size, header_idx_align) =
            (size_of::<BufferHeader>(), align_of::<BufferHeader>());

        let (input_size, input_align) = (
            size_of::<MessageBufferTemp>(),
            align_of::<MessageBufferTemp>(),
        );

        assert_eq!(header_idx_size, 514);
        assert_eq!(header_idx_align, 2);
        assert_eq!(input_size, 10_232);
        assert_eq!(input_align, 2);
    }

    #[test]
    fn test_put_all() {
        let data = vec![vec![12, 34], vec![56, 78, 90]];
        let data_bytes: Vec<Vec<u8>> = data.into_iter().map(data_bytes).collect();

        let accumulator_input = &mut MessageBufferTemp::new(0);

        let (num_msgs, num_bytes) = accumulator_input.put_all(&data_bytes);
        assert_eq!(num_msgs, 2);
        assert_eq!(num_bytes, 5);


        assert_eq!(accumulator_input.header.end_offsets[0], 2);
        assert_eq!(accumulator_input.header.end_offsets[1], 5);


        let message_buffer_bytes = bytes_of(accumulator_input);

        // The header_len field represents the size of all data prior to the message bytes.
        // This includes the account discriminator, which is not part of the header struct.
        // Subtract the size of the discriminator (8 bytes) to compensate
        let header_len = accumulator_input.header.header_len as usize - 8;


        let iter = accumulator_input
            .header
            .end_offsets
            .iter()
            .take_while(|x| **x != 0);
        let mut start = header_len;
        let mut data_iter = data_bytes.iter();
        for offset in iter {
            let end_offset = header_len + *offset as usize;
            let message_buffer_data = &message_buffer_bytes[start..end_offset];
            let expected_data = data_iter.next().unwrap();
            assert_eq!(message_buffer_data, expected_data.as_slice());
            start = end_offset;
        }
    }

    #[test]
    fn test_put_all_exceed_max() {
        let data = vec![vec![0u8; 9_718 - 2], vec![0u8], vec![0u8; 2]];

        let data_bytes: Vec<Vec<u8>> = data.into_iter().map(data_bytes).collect();
        let message_buffer = &mut MessageBufferTemp::new(0);
        let (num_msgs, num_bytes) = message_buffer.put_all(&data_bytes);
        assert_eq!(num_msgs, 2);
        assert_eq!(
            num_bytes,
            data_bytes[0..2].iter().map(|x| x.len()).sum::<usize>() as u16
        );

        let message_buffer_bytes = bytes_of(message_buffer);

        // The header_len field represents the size of all data prior to the message bytes.
        // This includes the account discriminator, which is not part of the header struct.
        // Subtract the size of the discriminator (8 bytes) to compensate
        let header_len = message_buffer.header.header_len as usize - 8;


        let iter = message_buffer
            .header
            .end_offsets
            .iter()
            .take_while(|x| **x != 0);
        let mut start = header_len;
        let mut data_iter = data_bytes.iter();
        for offset in iter {
            let end_offset = header_len + *offset as usize;
            let message_buffer_data = &message_buffer_bytes[start..end_offset];
            let expected_data = data_iter.next().unwrap();
            assert_eq!(message_buffer_data, expected_data.as_slice());
            start = end_offset;
        }

        assert_eq!(message_buffer.header.end_offsets[2], 0);
    }

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
        let message_buffer = &mut MessageBufferTemp::new(0);
        let (num_msgs, num_bytes) = message_buffer.put_all(&data_bytes);
        assert_eq!(num_msgs, 3);
        assert_eq!(
            num_bytes,
            data_bytes[0..3].iter().map(|x| x.len()).sum::<usize>() as u16
        );

        let message_buffer_bytes = bytes_of(message_buffer);

        // *note* minus 8 here since no account discriminator when using
        // `bytes_of`directly on accumulator_input
        let header_len = message_buffer.header.header_len as usize - 8;


        let iter = message_buffer
            .header
            .end_offsets
            .iter()
            .take_while(|x| **x != 0);
        let mut start = header_len;
        let mut data_iter = data_bytes.iter();
        for offset in iter {
            let end_offset = header_len + *offset as usize;
            let message_buffer_data = &message_buffer_bytes[start..end_offset];
            let expected_data = data_iter.next().unwrap();
            assert_eq!(message_buffer_data, expected_data.as_slice());
            start = end_offset;
        }

        assert_eq!(message_buffer.header.end_offsets[0], 9_715);
        assert_eq!(message_buffer.header.end_offsets[1], 9_716);
        assert_eq!(message_buffer.header.end_offsets[2], 9_717);
        assert_eq!(message_buffer.header.end_offsets[3], 0);
        assert_eq!(message_buffer.header.end_offsets[4], 0);
    }
}
