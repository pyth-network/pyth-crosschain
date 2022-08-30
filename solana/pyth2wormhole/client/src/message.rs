//! Re-usable message scheme for pyth2wormhole

use solana_program::system_instruction;
use std::{
    collections::VecDeque,
    time::{
        Duration,
        Instant,
    },
};

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
    /// The tracked accounts. Sorted from oldest to newest, as guaranteed by get_account()
    accounts: VecDeque<P2WMessageAccount>,
    /// How much time needs to pass between reuses
    grace_period: Duration,
}

impl P2WMessageIndex {
    pub fn new(grace_period: Duration) -> Self {
        Self {
            accounts: VecDeque::new(),
            grace_period,
        }
    }
    /// Finds or creates an account with last_used at least grace_period in the past.
    ///
    /// This method governs the self.accounts queue and preserves its sorted state.
    pub fn get_account(&mut self) -> P2WMessageAccount {
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

                // Use a new account instead
                P2WMessageAccount {
                    id: self.accounts.len() as u64,
                    last_used: Instant::now(),
                }
            }
            // Base case: Index is empty, use a new account
            None => P2WMessageAccount {
                id: self.accounts.len() as u64,
                last_used: Instant::now(),
            },
        };
        // The chosen account becomes the newest, push it to the very end. 
        self.accounts.push_back(acc.clone());
        return acc;
    }
}
