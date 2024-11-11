pub use price::*;

mod price;

trait PythAccount {
    const ACCOUNT_TYPE: PythAccountType;
    fn account_type() -> PythAccountType {
        Self::ACCOUNT_TYPE
    }
}

#[derive(Copy, Clone)]
#[repr(u32)]
pub enum PythAccountType {
    Mapping = 1,
    Product = 2,
    Price = 3,
    Test = 4,
    Permissions = 5,
}
