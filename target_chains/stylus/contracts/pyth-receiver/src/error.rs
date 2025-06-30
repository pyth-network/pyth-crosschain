use alloc::vec::Vec;

pub enum PythReceiverError {
    PriceUnavailable
}

impl core::fmt::Debug for PythReceiverError {
    fn fmt(&self, _: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        Ok(())
    }
}

impl From<PythReceiverError> for Vec<u8> {
    fn from(error: PythReceiverError) -> Vec<u8> {
        vec![match error {
            PythReceiverError::PriceUnavailable => 1,
        }]
    }
}