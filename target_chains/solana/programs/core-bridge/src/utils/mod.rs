//! Utilities for the Core Bridge Program.
pub mod cpi;

pub mod vaa;

use anchor_lang::prelude::*;

/// Compute quorum based on the number of guardians in a guardian set.
#[inline]
pub fn quorum(num_guardians: usize) -> usize {
    cfg_if::cfg_if! {
        if #[cfg(feature = "lazer")] {
            num_guardians / 2 + 1
        } else {
            (2 * num_guardians) / 3 + 1
        }
    }
}

/// Close an account by transferring all its lamports to another account.
pub(crate) fn close_account(info: &AccountInfo, sol_destination: &AccountInfo) -> Result<()> {
    // Transfer tokens from the account to the sol_destination.
    let dest_starting_lamports = sol_destination.lamports();
    **sol_destination.lamports.borrow_mut() =
        dest_starting_lamports.checked_add(info.lamports()).unwrap();
    **info.lamports.borrow_mut() = 0;

    info.assign(&solana_program::system_program::ID);
    info.resize(0).map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(feature = "lazer")]
    fn test_quorum() {
        assert_eq!(quorum(5), 3);
        assert_eq!(quorum(19), 10);
    }

    #[test]
    #[cfg(not(feature = "lazer"))]
    fn test_quorum() {
        assert_eq!(quorum(5), 4);
        assert_eq!(quorum(19), 13);
    }
}
