use crate::PythAccountType;

pub mod price;

#[derive(Copy, Clone)]
#[repr(u8)]
pub enum PythSchema {
    Full    = 0,
    Compact = 1,
    Minimal = 2,
}

impl PythSchema {
    pub fn to_u8(&self) -> u8 {
        *self as u8
    }
}

// TODO:
//  should these account_type -> schema mappings be stored in an account somewhere?
pub fn get_schemas(account_type: PythAccountType) -> Vec<PythSchema> {
    match account_type {
        PythAccountType::Price => vec![PythSchema::Full, PythSchema::Compact],
        _ => vec![],
    }
}
