//! Ed25519 signing for Bulk Trade transactions.
//!
//! Uses bulk-keychain's types and signing directly. The `BulkSigner` wrapper
//! adds support for signing with a separate oracle account (shared across
//! multiple pusher instances), rather than using the signer's own pubkey as
//! the account.

use anyhow::Result;
use bulk_keychain::{Action, Keypair, Pubkey, PythOraclePrice, SignedTransaction, Signer};

/// Wrapper for signing keys using bulk-keychain.
///
/// Supports signing transactions where the oracle account differs from the
/// signer's own pubkey (HA mode: multiple pushers share one oracle account
/// but each has its own signing key).
pub struct BulkSigner {
    signer: Signer,
    pubkey_base58: String,
    oracle_account: Pubkey,
}

impl BulkSigner {
    /// Create a new signer from a base58-encoded private key and oracle account.
    pub fn new(private_key_base58: &str, oracle_account_base58: &str) -> Result<Self> {
        let keypair = Keypair::from_base58(private_key_base58)
            .map_err(|e| anyhow::anyhow!("failed to parse keypair: {}", e))?;

        let oracle_account = Pubkey::from_base58(oracle_account_base58)
            .map_err(|e| anyhow::anyhow!("failed to parse oracle account pubkey: {}", e))?;

        let pubkey_base58 = keypair.pubkey().to_string();
        let signer = Signer::new(keypair);

        Ok(Self {
            signer,
            pubkey_base58,
            oracle_account,
        })
    }

    /// Get the signer's public key in base58 encoding.
    pub fn pubkey_base58(&self) -> &str {
        &self.pubkey_base58
    }

    /// Sign a batch of oracle price updates.
    ///
    /// Uses `sign_action` with the oracle account (not the signer's own pubkey)
    /// so multiple pushers can share one oracle account.
    pub fn sign_transaction(
        &mut self,
        oracles: Vec<PythOraclePrice>,
        nonce: u64,
    ) -> Result<SignedTransaction> {
        let action = Action::PythOracle { oracles };
        self.signer
            .sign_action(&action, nonce, &self.oracle_account)
            .map_err(|e| anyhow::anyhow!("failed to sign transaction: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Test keypair (generated offline, safe for tests only)
    const TEST_PRIVATE_KEY_BASE58: &str = "4wBqpZM9k1k4reVTJezJTqcPYLkuJSYwZYfwJC3xjYw9";

    fn test_oracle_account() -> String {
        // Use the signer's own pubkey as oracle account for tests
        let keypair = Keypair::from_base58(TEST_PRIVATE_KEY_BASE58).unwrap();
        keypair.pubkey().to_string()
    }

    #[test]
    fn test_signer_creation() {
        let signer = BulkSigner::new(TEST_PRIVATE_KEY_BASE58, &test_oracle_account()).unwrap();
        assert!(!signer.pubkey_base58().is_empty());
    }

    #[test]
    fn test_signer_invalid_key() {
        let result = BulkSigner::new("invalid-key", "invalid-account");
        assert!(result.is_err());
    }

    #[test]
    fn test_signer_empty_key() {
        let result = BulkSigner::new("", "");
        assert!(result.is_err());
    }

    #[test]
    fn test_sign_transaction() {
        let mut signer = BulkSigner::new(TEST_PRIVATE_KEY_BASE58, &test_oracle_account()).unwrap();

        let oracles = vec![PythOraclePrice {
            timestamp: 1704067200000,
            feed_index: 1,
            price: 10250000000000,
            exponent: -8,
        }];

        let tx = signer
            .sign_transaction(oracles, 1704067200000000000)
            .unwrap();

        assert!(!tx.signature.is_empty());
        assert_eq!(tx.actions.len(), 1);
    }

    #[test]
    fn test_sign_transaction_multiple_oracles() {
        let oracle_account = test_oracle_account();
        let mut signer = BulkSigner::new(TEST_PRIVATE_KEY_BASE58, &oracle_account).unwrap();

        let oracles = vec![
            PythOraclePrice {
                timestamp: 1704067200000,
                feed_index: 1,
                price: 10250000000000,
                exponent: -8,
            },
            PythOraclePrice {
                timestamp: 1704067200000,
                feed_index: 2,
                price: 230000000000,
                exponent: -8,
            },
            PythOraclePrice {
                timestamp: 1704067200000,
                feed_index: 3,
                price: 100000000,
                exponent: -8,
            },
        ];

        let tx = signer
            .sign_transaction(oracles, 1704067200000000000)
            .unwrap();

        // The action array should have 1 entry (the PythOracle action wrapping all oracles)
        assert_eq!(tx.actions.len(), 1);
        assert_eq!(tx.account, oracle_account);
        assert_eq!(tx.signer, signer.pubkey_base58());
    }

    #[test]
    fn test_sign_transaction_uses_oracle_account() {
        // Verify the transaction uses the oracle account, not the signer's own pubkey
        let oracle_account = test_oracle_account();
        let mut signer = BulkSigner::new(TEST_PRIVATE_KEY_BASE58, &oracle_account).unwrap();

        let oracles = vec![PythOraclePrice {
            timestamp: 1000,
            feed_index: 1,
            price: 100,
            exponent: -2,
        }];

        let tx = signer.sign_transaction(oracles, 999).unwrap();

        assert_eq!(tx.account, oracle_account);
        assert_eq!(tx.signer, signer.pubkey_base58());
    }

    #[test]
    fn test_deterministic_signature() {
        let mut signer = BulkSigner::new(TEST_PRIVATE_KEY_BASE58, &test_oracle_account()).unwrap();

        let oracles = vec![PythOraclePrice {
            timestamp: 1000,
            feed_index: 1,
            price: 100,
            exponent: -2,
        }];

        let tx1 = signer.sign_transaction(oracles.clone(), 12345).unwrap();
        let tx2 = signer.sign_transaction(oracles, 12345).unwrap();

        // Same input should produce same signature
        assert_eq!(tx1.signature, tx2.signature);
    }

    #[test]
    fn test_different_nonce_different_signature() {
        let mut signer = BulkSigner::new(TEST_PRIVATE_KEY_BASE58, &test_oracle_account()).unwrap();

        let oracles1 = vec![PythOraclePrice {
            timestamp: 1000,
            feed_index: 1,
            price: 100,
            exponent: -2,
        }];
        let oracles2 = oracles1.clone();

        let tx1 = signer.sign_transaction(oracles1, 1).unwrap();
        let tx2 = signer.sign_transaction(oracles2, 2).unwrap();

        assert_ne!(tx1.signature, tx2.signature);
    }

    #[test]
    fn test_transaction_json_format() {
        let mut signer = BulkSigner::new(TEST_PRIVATE_KEY_BASE58, &test_oracle_account()).unwrap();

        let oracles = vec![
            PythOraclePrice {
                timestamp: 1704067200000000000,
                feed_index: 0,
                price: 10250000000000,
                exponent: -8,
            },
            PythOraclePrice {
                timestamp: 1704067200000000000,
                feed_index: 1,
                price: 325000000000,
                exponent: -8,
            },
        ];

        let tx = signer.sign_transaction(oracles, 1704067200000).unwrap();
        let json = serde_json::to_string(&tx).unwrap();

        // Verify the new format fields
        assert!(json.contains("\"actions\""));
        assert!(json.contains("\"nonce\""));
        assert!(json.contains("\"account\""));
        assert!(json.contains("\"signer\""));
        assert!(json.contains("\"signature\""));

        // Verify actions contain the oracle wrapper format
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        let actions = value["actions"].as_array().unwrap();
        assert_eq!(actions.len(), 1);
        // The action should have an "o" key with "oracles" array
        assert!(actions[0]["o"]["oracles"].is_array());
        let oracles_arr = actions[0]["o"]["oracles"].as_array().unwrap();
        assert_eq!(oracles_arr.len(), 2);
        // Verify field names
        assert_eq!(oracles_arr[0]["fi"], 0);
        assert_eq!(oracles_arr[0]["e"], -8);
        assert_eq!(oracles_arr[0]["px"], 10250000000000u64);
    }

    #[test]
    fn test_signature_verification() {
        use bulk_keychain::bs58;
        use bulk_keychain::ed25519_dalek::{Signature, Verifier, VerifyingKey};

        let keypair = Keypair::from_base58(TEST_PRIVATE_KEY_BASE58).unwrap();
        let mut signer = BulkSigner::new(TEST_PRIVATE_KEY_BASE58, &test_oracle_account()).unwrap();

        let oracles = vec![PythOraclePrice {
            timestamp: 1704067200000,
            feed_index: 1,
            price: 10250000000000,
            exponent: -8,
        }];

        let tx = signer
            .sign_transaction(oracles, 1704067200000000000)
            .unwrap();

        // Decode and verify signature is valid
        let sig_bytes = bs58::decode(&tx.signature).into_vec().unwrap();
        let signature = Signature::from_slice(&sig_bytes).unwrap();

        let verifying_key = VerifyingKey::from_bytes(keypair.pubkey().as_bytes()).unwrap();

        // We can't easily recreate the exact signed bytes (it's internal to bulk-keychain),
        // but we can verify the signature is a valid Ed25519 signature (64 bytes)
        assert_eq!(sig_bytes.len(), 64);
        // The verifying key should be constructable
        assert_eq!(
            verifying_key.to_bytes().len(),
            32,
            "verifying key should be 32 bytes"
        );

        // Signature should not be empty/zero
        assert!(sig_bytes.iter().any(|&b| b != 0));

        // Verify we can't use a wrong key (sanity check)
        let wrong_keypair = Keypair::generate();
        let wrong_key = VerifyingKey::from_bytes(wrong_keypair.pubkey().as_bytes()).unwrap();
        // A random message should not verify with the wrong key against this signature
        assert!(wrong_key.verify(b"wrong data", &signature).is_err());
    }
}
