use futures::future::TryFutureExt;
use log::{
    debug,
    trace,
    warn,
};
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::signature::Signature;

use pyth_sdk_solana::state::PriceAccount;

use std::time::{
    Duration,
    Instant,
};

use crate::{
    AttestationConditions,
    ErrBox,
    P2WSymbol,
};

/// Runtime representation of a batch. It refers the original group
/// from config and its respective attestation conditions.
#[derive(Debug)]
pub struct BatchState<'a> {
    pub group_name: String,
    pub symbols: &'a [P2WSymbol],
    pub last_known_symbol_states: Vec<Option<PriceAccount>>,
    pub conditions: AttestationConditions,
    pub last_job_finished_at: Instant,
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
            last_known_symbol_states: vec![None; symbols.len()],
            last_job_finished_at: Instant::now(),
        }
    }

    /// Evaluate the configured attestation conditions for this
    /// batch. RPC is used to update last known state. Returns
    /// Some("<reason>") if any trigger condition was met. Only the
    /// first encountered condition is mentioned.
    pub async fn should_resend(&mut self, c: &RpcClient) -> Option<String> {
        let mut ret = None;

        let sym_count = self.symbols.len();
        let mut new_symbol_states: Vec<Option<PriceAccount>> = Vec::with_capacity(sym_count);
        let mut lookup_failures = vec![];
        for (idx, sym) in self.symbols.iter().enumerate() {
            let new_state = match c
                .get_account_data(&sym.price_addr)
                .map_err(|e| e.to_string())
                .and_then(|bytes| async move {
                    pyth_sdk_solana::state::load_price_account(&bytes)
                        .map(|state| state.clone())
                        .map_err(|e| e.to_string())
                })
                .await
            {
                Ok(state) => Some(state),
                Err(e) => {
                    trace!(
                        "Symbol {:?} ({}/{}): Could not look up state: {}",
                        sym.to_string(),
                        idx + 1,
                        sym_count,
                        e.to_string()
                    );
                    lookup_failures.push(sym.to_string());
                    None
                }
            };

            new_symbol_states.push(new_state);
        }

        if !lookup_failures.is_empty() {
            warn!(
                "should_resend(): {}/{} symbol state lookups failed:\n{:?}",
                lookup_failures.len(),
                self.symbols.len(),
                lookup_failures
            );
        }

        // min interval
        if self.last_job_finished_at.elapsed()
            > Duration::from_secs(self.conditions.min_interval_secs)
        {
            ret = Some(format!(
                "minimum interval of {}s elapsed since last state change",
                self.conditions.min_interval_secs
            ));
        }

        for (idx, old_new_tup) in self
            .last_known_symbol_states
            .iter_mut() // Borrow mutably to make the update easier
            .zip(new_symbol_states.iter())
            .enumerate()
        {
            //  Only evaluate this symbol if a triggering condition is not already met
            if ret.is_none() {
                match old_new_tup {
                    (Some(old), Some(new)) => {
                        // publish_time_changed
                        if let Some(min_delta_secs) = self.conditions.publish_time_min_delta_secs {
                            if new.timestamp - old.timestamp > min_delta_secs as i64 {
                                ret = Some(format!(
                                    "publish_time advanced by at least {}s for {:?}",
                                    min_delta_secs,
                                    self.symbols[idx].to_string(),
                                ))
                            }

                        // price_changed_pct
                        } else if let Some(pct) = self.conditions.price_changed_pct {
                            let pct = pct.abs();
                            let price_pct_diff = ((old.agg.price as f64 - new.agg.price as f64)
                                / old.agg.price as f64
                                * 100.0)
                                .abs();

                            if price_pct_diff > pct {
                                ret = Some(format!(
                                    "price moved by at least {}% for {:?}",
                                    pct,
                                    self.symbols[idx].to_string()
                                ))
                            }
                        }
                    }
                    _ => {
                        debug!(
                            "Symbol {:?} {}/{}, old or new state value is None, skipping...",
                            self.symbols[idx].to_string(),
                            idx + 1,
                            sym_count
                        );
                    }
                }
            }
        }

        // Update with newer state if a condition was met
        if ret.is_some() {
            for (old, new) in self
                .last_known_symbol_states
                .iter_mut()
                .zip(new_symbol_states.into_iter())
            {
                if new.is_some() {
                    *old = new;
                }
            }
        }

        return ret;
    }
}
