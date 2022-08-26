//! Re-usable message scheme for pyth2wormhole

use solana_program::system_instruction;
use std::time::Instant;
use std::time::Duration;

use crate::ErrBox;

/// One of the accounts tracked by the attestation client.
#[derive(Clone, Debug)]
pub struct P2WMessageAccount {
    /// Unique ID that lets us derive unique accounts for use on-chain
    pub id: u64,
    /// Last time we've posted a message to wormhole with this account
    pub last_used: Instant,
}

/// An umbrella data structure for tracking all message accounts in use
#[derive(Clone, Debug)]
pub struct P2WMessageIndex {
    /// The tracked accounts
    accounts: Vec<P2WMessageAccount>,
    /// How much time needs to pass between reuses
    grace_period: Duration,
}

impl P2WMessageIndex {
    pub fn new(grace_period: Duration) -> Self {
        Self {
            accounts: Vec::new(),
            grace_period
        }
    }
    /// Finds an account with last_used at least grace_period in the past
    pub fn get_account(&mut self) -> P2WMessageAccount {
        let mut ret = None;
        // Look for the first account available
        for (idx, acc) in self.accounts.iter().enumerate() {
            if acc.last_used.elapsed() >= self.grace_period {
                // Note: Don't confuse idx (the LinkedList position)
                // with the id field on P2WMessageAccount.
                ret = Some((idx, acc.clone()));
                break;
            }
        }
        // Found a good account, no need to add one
        if let Some((idx,mut acc)) = ret {
            self.accounts.remove(idx);

            // Update last_used
            acc.last_used = Instant::now();
            self.accounts.push(acc.clone());

            return acc;
        // All accounts were used recently, add a new one
        } else {
            let next_id = self.accounts.len() as u64;
            let new = P2WMessageAccount {
                id: next_id,
                last_used: Instant::now()
            };
            
            self.accounts.push(new.clone());
            return new;
        }
    }
}
