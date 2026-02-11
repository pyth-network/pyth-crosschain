//! Ed25519 signing for Bulk Trade transactions.
//!
//! Bulk transactions are signed using Ed25519. The signature is computed over
//! the bincode serialization of the transaction, excluding the final 64 bytes
//! (the signature field itself).
//!
//! Note: This module uses our own message types (OracleAction, OracleUpdate) with
//! integer prices + exponent format. The bulk-keychain crate's OraclePrice uses f64,
//! which doesn't match. Once bulk-keychain supports our format, we can migrate to
//! using their types directly.

use anyhow::{Context as _, Result};
use bulk_keychain::{Keypair, Signer};
use serde::{Deserialize, Serialize};

/// Action type for Bulk transactions.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActionType {
    #[serde(rename = "pythoracle")]
    PythOracle,
}

/// Oracle transaction to be sent to Bulk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleTransaction {
    pub action: OracleAction,
    pub account: String,
    pub signer: String,
    pub signature: String,
}

/// The action payload containing oracle price updates.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleAction {
    #[serde(rename = "type")]
    pub action_type: ActionType,
    pub oracles: Vec<OracleUpdate>,
    pub nonce: u64,
}

/// A single oracle price update.
/// Prices are sent as integers with exponent, matching Lazer's native format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OracleUpdate {
    /// Timestamp in milliseconds (epoch)
    pub t: u64,
    /// Pyth Lazer price feed ID (Bulk handles feed ID to symbol mapping)
    #[serde(rename = "fi")]
    pub price_feed_id: u32,
    /// Price as integer (multiply by 10^exponent to get actual price)
    pub px: i64,
    /// Price exponent (e.g., -8 means price = px * 10^-8)
    #[serde(rename = "ex")]
    pub expo: i16,
}

/// Wrapper for signing keys using bulk-keychain.
pub struct BulkSigner {
    signer: Signer,
    pubkey_base58: String,
}

impl BulkSigner {
    /// Create a new signer from a base58-encoded private key.
    pub fn from_base58(private_key_base58: &str) -> Result<Self> {
        let keypair = Keypair::from_base58(private_key_base58)
            .map_err(|e| anyhow::anyhow!("failed to parse keypair: {}", e))?;

        let pubkey_base58 = keypair.pubkey().to_string();
        let signer = Signer::new(keypair);

        Ok(Self {
            signer,
            pubkey_base58,
        })
    }

    /// Get the public key in base58 encoding.
    pub fn pubkey_base58(&self) -> &str {
        &self.pubkey_base58
    }
}

/// Signable portion of the transaction (without signature field).
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SignableTransaction {
    action: OracleAction,
    account: String,
    signer: String,
}

impl BulkSigner {
    /// Sign an oracle transaction.
    ///
    /// Serializes the signable portion (action, account, signer) using bincode
    /// and signs it with the Ed25519 key via bulk-keychain.
    pub fn sign_transaction(
        &self,
        action: OracleAction,
        account: &str,
    ) -> Result<OracleTransaction> {
        let signable = SignableTransaction {
            action: action.clone(),
            account: account.to_string(),
            signer: self.pubkey_base58.clone(),
        };

        // Serialize the signable portion
        let config = bincode::config::legacy();
        let signable_data = bincode::serde::encode_to_vec(&signable, config)
            .context("failed to serialize transaction for signing")?;

        // Sign using bulk-keychain
        let signature = self.signer.sign_bytes(&signable_data);

        Ok(OracleTransaction {
            action,
            account: account.to_string(),
            signer: self.pubkey_base58.clone(),
            signature,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test keypair (generated offline, safe for tests only)
    const TEST_PRIVATE_KEY_BASE58: &str = "4wBqpZM9k1k4reVTJezJTqcPYLkuJSYwZYfwJC3xjYw9";

    #[test]
    fn test_signer_creation() {
        let signer = BulkSigner::from_base58(TEST_PRIVATE_KEY_BASE58).unwrap();
        assert!(!signer.pubkey_base58().is_empty());
    }

    #[test]
    fn test_signer_invalid_key() {
        let result = BulkSigner::from_base58("invalid-key");
        assert!(result.is_err());
    }

    #[test]
    fn test_signer_empty_key() {
        let result = BulkSigner::from_base58("");
        assert!(result.is_err());
    }

    #[test]
    fn test_sign_transaction() {
        let signer = BulkSigner::from_base58(TEST_PRIVATE_KEY_BASE58).unwrap();

        let action = OracleAction {
            action_type: ActionType::PythOracle,
            oracles: vec![OracleUpdate {
                t: 1704067200000,
                price_feed_id: 1,
                px: 10250000000000,
                expo: -8,
            }],
            nonce: 1704067200000000000,
        };

        let tx = signer
            .sign_transaction(action, signer.pubkey_base58())
            .unwrap();

        assert!(!tx.signature.is_empty());
        assert_eq!(tx.action.action_type, ActionType::PythOracle);
    }

    #[test]
    fn test_sign_transaction_multiple_oracles() {
        let signer = BulkSigner::from_base58(TEST_PRIVATE_KEY_BASE58).unwrap();

        let action = OracleAction {
            action_type: ActionType::PythOracle,
            oracles: vec![
                OracleUpdate {
                    t: 1704067200000,
                    price_feed_id: 1,
                    px: 10250000000000,
                    expo: -8,
                },
                OracleUpdate {
                    t: 1704067200000,
                    price_feed_id: 2,
                    px: 230000000000,
                    expo: -8,
                },
                OracleUpdate {
                    t: 1704067200000,
                    price_feed_id: 3,
                    px: 100000000,
                    expo: -8,
                },
            ],
            nonce: 1704067200000000000,
        };

        let tx = signer.sign_transaction(action, "test-account").unwrap();

        assert_eq!(tx.action.oracles.len(), 3);
        assert_eq!(tx.account, "test-account");
        assert_eq!(tx.signer, signer.pubkey_base58());
    }

    #[test]
    fn test_sign_transaction_empty_oracles() {
        let signer = BulkSigner::from_base58(TEST_PRIVATE_KEY_BASE58).unwrap();

        let action = OracleAction {
            action_type: ActionType::PythOracle,
            oracles: vec![],
            nonce: 123456789,
        };

        let tx = signer.sign_transaction(action, "account").unwrap();
        assert!(tx.action.oracles.is_empty());
        assert!(!tx.signature.is_empty());
    }

    #[test]
    fn test_oracle_update_serialization() {
        let update = OracleUpdate {
            t: 1704067200000,
            price_feed_id: 42,
            px: -12345678,
            expo: -8,
        };

        let json = serde_json::to_string(&update).unwrap();
        assert!(json.contains("\"fi\":42"));
        assert!(json.contains("\"ex\":-8"));
        assert!(json.contains("\"px\":-12345678"));
    }

    #[test]
    fn test_action_type_serialization() {
        let action = OracleAction {
            action_type: ActionType::PythOracle,
            oracles: vec![],
            nonce: 0,
        };

        let json = serde_json::to_string(&action).unwrap();
        assert!(json.contains("\"type\":\"pythoracle\""));
    }

    #[test]
    fn test_transaction_serialization() {
        let signer = BulkSigner::from_base58(TEST_PRIVATE_KEY_BASE58).unwrap();

        let action = OracleAction {
            action_type: ActionType::PythOracle,
            oracles: vec![OracleUpdate {
                t: 1000,
                price_feed_id: 1,
                px: 100,
                expo: -2,
            }],
            nonce: 999,
        };

        let tx = signer.sign_transaction(action, "my-account").unwrap();
        let json = serde_json::to_string(&tx).unwrap();

        assert!(json.contains("\"account\":\"my-account\""));
        assert!(json.contains("\"signer\":"));
        assert!(json.contains("\"signature\":"));
    }

    #[test]
    fn test_deterministic_signature() {
        let signer = BulkSigner::from_base58(TEST_PRIVATE_KEY_BASE58).unwrap();

        let action1 = OracleAction {
            action_type: ActionType::PythOracle,
            oracles: vec![OracleUpdate {
                t: 1000,
                price_feed_id: 1,
                px: 100,
                expo: -2,
            }],
            nonce: 12345,
        };

        let action2 = action1.clone();

        let tx1 = signer.sign_transaction(action1, "account").unwrap();
        let tx2 = signer.sign_transaction(action2, "account").unwrap();

        // Same input should produce same signature
        assert_eq!(tx1.signature, tx2.signature);
    }

    #[test]
    fn test_different_nonce_different_signature() {
        let signer = BulkSigner::from_base58(TEST_PRIVATE_KEY_BASE58).unwrap();

        let action1 = OracleAction {
            action_type: ActionType::PythOracle,
            oracles: vec![],
            nonce: 1,
        };

        let action2 = OracleAction {
            action_type: ActionType::PythOracle,
            oracles: vec![],
            nonce: 2,
        };

        let tx1 = signer.sign_transaction(action1, "account").unwrap();
        let tx2 = signer.sign_transaction(action2, "account").unwrap();

        assert_ne!(tx1.signature, tx2.signature);
    }

    #[test]
    fn test_signature_verification() {
        use bulk_keychain::bs58;
        use bulk_keychain::ed25519_dalek::{Signature, Verifier, VerifyingKey};

        let keypair = Keypair::from_base58(TEST_PRIVATE_KEY_BASE58).unwrap();
        let signer = BulkSigner::from_base58(TEST_PRIVATE_KEY_BASE58).unwrap();

        let action = OracleAction {
            action_type: ActionType::PythOracle,
            oracles: vec![OracleUpdate {
                t: 1704067200000,
                price_feed_id: 1,
                px: 10250000000000,
                expo: -8,
            }],
            nonce: 1704067200000000000,
        };

        let tx = signer
            .sign_transaction(action.clone(), "test-account")
            .unwrap();

        // Recreate signable data
        let signable = SignableTransaction {
            action,
            account: "test-account".to_string(),
            signer: signer.pubkey_base58().to_string(),
        };
        let config = bincode::config::legacy();
        let signable_data = bincode::serde::encode_to_vec(&signable, config).unwrap();

        // Decode signature from base58
        let sig_bytes = bs58::decode(&tx.signature).into_vec().unwrap();
        let signature = Signature::from_slice(&sig_bytes).unwrap();

        // Get verifying key from pubkey bytes
        let verifying_key = VerifyingKey::from_bytes(keypair.pubkey().as_bytes()).unwrap();

        // Verify signature
        assert!(verifying_key.verify(&signable_data, &signature).is_ok());
    }
}
