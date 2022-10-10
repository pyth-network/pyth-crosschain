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
    RLMutex,
};

/// Runtime representation of a batch. It refers to the original group
/// from the config.
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
        let pubkeys: Vec<_> = self.symbols.iter().map(|s| s.price_addr).collect();

        // min interval
        if self.last_job_finished_at.elapsed()
            > Duration::from_secs(self.conditions.min_interval_secs)
        {
            ret = Some(format!(
                "minimum interval of {}s elapsed since last state change",
                self.conditions.min_interval_secs
            ));
        }

        // Only lookup and compare symbols if the conditions require
        if self.conditions.is_onchain() {
            let mut new_symbol_states: Vec<Option<PriceAccount>> =
                match c.get_multiple_accounts(&pubkeys).await {
                    Ok(acc_opts) => {
                        acc_opts
                            .into_iter()
                            .enumerate()
                            .map(|(idx, opt)| {
                                // Take each Some(acc), make it None and log on load_price_account() error
                                opt.and_then(|acc| {
                                    pyth_sdk_solana::state::load_price_account(&acc.data)
                                        .cloned() // load_price_account() transmutes the data reference into another reference, and owning acc_opts is not enough
                                        .map_err(|e| {
                                            warn!(
                                                "Could not parse symbol {}/{}: {}",
                                                idx, sym_count, e
                                            );
                                            e
                                        })
                                        .ok() // Err becomes None
                                })
                            })
                            .collect()
                    }
                    Err(e) => {
                        warn!("Could not look up any symbols on-chain: {}", e);
                        vec![None; sym_count]
                    }
                };

            for (idx, old_new_tup) in self
                .last_known_symbol_states
                .iter_mut() // Borrow mutably to make the update easier
                .zip(new_symbol_states.iter())
                .enumerate()
            {
                //  Only evaluate this symbol if a triggering condition is not already met
                if ret.is_some() {
                    break;
                }
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
            // Update with newer state only if a condition was met. We
            // don't want to shadow changes that may happen over a larger
            // period between state lookups.
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
        }

        return ret;
    }
}
