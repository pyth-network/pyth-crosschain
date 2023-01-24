//! Re-usable message scheme for pyth2wormhole

use {
    crate::ErrBoxSend,
    log::debug,
    std::{
        collections::VecDeque,
        time::{
            Duration,
            Instant,
        },
    },
};

/// One of the accounts tracked by the attestation client.
#[derive(Clone, Debug)]
pub struct P2WMessageAccount {
    /// Unique ID that lets us derive unique accounts for use on-chain
    pub id:        u64,
    /// Last time we've posted a message to wormhole with this account
    pub last_used: Instant,
}

/// An umbrella data structure for tracking all message accounts in use
#[derive(Clone, Debug)]
pub struct P2WMessageQueue {
    /// The tracked accounts. Sorted from oldest to newest, as guaranteed by get_account()
    accounts:     VecDeque<P2WMessageAccount>,
    /// How much time needs to pass between reuses
    grace_period: Duration,
    /// A hard cap on how many accounts will be created.
    max_accounts: usize,
}

impl P2WMessageQueue {
    pub fn new(grace_period: Duration, max_accounts: usize) -> Self {
        Self {
            accounts: VecDeque::new(),
            grace_period,
            max_accounts,
        }
    }
    /// Finds or creates an account with last_used at least grace_period in the past.
    ///
    /// This method governs the self.accounts queue and preserves its sorted state.
    pub fn get_account(&mut self) -> Result<P2WMessageAccount, ErrBoxSend> {
        // Pick or add an account to use as message
        let acc = match self.accounts.pop_front() {
            // Exists and is old enough for reuse
            Some(mut existing_acc) if existing_acc.last_used.elapsed() > self.grace_period => {
                existing_acc.last_used = Instant::now();
                existing_acc
            }
            // Exists but isn't old enough for reuse
            Some(existing_too_new_acc) => {
                // Counter-act the pop, this account is still oldest
                // and will be old enough eventually.
                self.accounts.push_front(existing_too_new_acc);

                // Make sure we're not going over the limit
                if self.accounts.len() >= self.max_accounts {
                    return Err(format!(
                        "Max message queue size of {} reached.",
                        self.max_accounts
                    )
                    .into());
                }

                debug!(
                    "Increasing message queue size to {}",
                    self.accounts.len() + 1
                );

                // Use a new account instead
                P2WMessageAccount {
                    id:        self.accounts.len() as u64,
                    last_used: Instant::now(),
                }
            }
            // Base case: Queue is empty, use a new account
            None => P2WMessageAccount {
                id:        self.accounts.len() as u64,
                last_used: Instant::now(),
            },
        };
        // The chosen account becomes the newest, push it to the very end.
        self.accounts.push_back(acc.clone());
        Ok(acc)
    }
}

#[cfg(test)]
pub mod test {
    use super::*;

    #[test]
    fn test_empty_grows_only_as_needed() -> Result<(), ErrBoxSend> {
        let mut q = P2WMessageQueue::new(Duration::from_millis(500), 100_000);

        // Empty -> 1 account
        let acc = q.get_account()?;

        assert_eq!(q.accounts.len(), 1);
        assert_eq!(acc.id, 0);

        // 1 -> 2 accounts, not enough time passes
        let acc2 = q.get_account()?;

        assert_eq!(q.accounts.len(), 2);
        assert_eq!(acc2.id, 1);

        std::thread::sleep(Duration::from_millis(600));

        // Account 0 should be in front, enough time passed
        let acc3 = q.get_account()?;

        assert_eq!(q.accounts.len(), 2);
        assert_eq!(acc3.id, 0);

        // Account 1 also qualifies
        let acc4 = q.get_account()?;

        assert_eq!(q.accounts.len(), 2);
        assert_eq!(acc4.id, 1);

        // 2 -> 3 accounts, not enough time passes
        let acc5 = q.get_account()?;

        assert_eq!(q.accounts.len(), 3);
        assert_eq!(acc5.id, 2);

        // We should end up with 0, 1 and 2 in order
        assert_eq!(q.accounts[0].id, 0);
        assert_eq!(q.accounts[1].id, 1);
        assert_eq!(q.accounts[2].id, 2);

        Ok(())
    }
}
