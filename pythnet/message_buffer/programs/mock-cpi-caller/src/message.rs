use crate::state::PythAccountType;

pub mod price;

#[derive(Copy, Clone)]
#[repr(u8)]
pub enum MessageSchema {
    Full = 0,
    Compact = 1,
    Minimal = 2,
    Dummy = 3,
}

impl MessageSchema {
    pub fn to_u8(&self) -> u8 {
        *self as u8
    }
}

pub fn get_schemas(account_type: PythAccountType) -> Vec<MessageSchema> {
    match account_type {
        PythAccountType::Price => vec![MessageSchema::Full, MessageSchema::Compact],
        _ => vec![MessageSchema::Full],
    }
}

pub trait AccumulatorSerializer {
    fn accumulator_serialize(&self) -> anchor_lang::Result<Vec<u8>>;
}
