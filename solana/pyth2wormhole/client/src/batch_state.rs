use solana_sdk::signature::Signature;

use std::time::Instant;

use crate::{
    AttestationConditions,
    ErrBox,
    P2WSymbol,
};

#[derive(Debug)]
pub struct BatchState<'a> {
    pub group_name: String,
    pub symbols: &'a [P2WSymbol],
    pub conditions: AttestationConditions,
    status: BatchTxStatus,
    status_changed_at: Instant,
}

impl<'a> BatchState<'a> {
    pub fn new(
        group_name: String,
        symbols: &'a [P2WSymbol],
        conditions: AttestationConditions,
    ) -> Self {
        Self {
            group_name,
            symbols,
            conditions,
            status: BatchTxStatus::Sending { attempt_no: 1 },
            status_changed_at: Instant::now(),
        }
    }
    /// Ensure only set_status() alters the timestamp
    pub fn get_status_changed_at(&self) -> &Instant {
        &self.status_changed_at
    }
    pub fn get_status(&self) -> &BatchTxStatus {
        &self.status
    }
    /// Ensure that status changes are accompanied by a timestamp bump
    pub fn set_status(&mut self, s: BatchTxStatus) {
        self.status_changed_at = Instant::now();
        self.status = s;
    }
}

#[derive(Debug)]
pub enum BatchTxStatus {
    Sending {
        attempt_no: usize,
    },
    Confirming {
        attempt_no: usize,
        signature: Signature,
    },
    Success {
        seqno: String,
    },
    FailedSend {
        last_err: ErrBox,
    },
    FailedConfirm {
        last_err: ErrBox,
    },
}
