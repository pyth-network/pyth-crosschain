pub use put_all::*;
pub use create_buffer::*;
pub use resize_buffer::*;
pub use delete_buffer::*;

mod put_all;
mod create_buffer;
mod resize_buffer;
mod delete_buffer;

// String constants for deriving PDAs.
// An authorized program's message buffer will have PDA seeds [authorized_program_pda, MESSAGE, base_account_key],
// where authorized_program_pda is the
pub const MESSAGE: &str = "message";
pub const FUND: &str = "fund";
