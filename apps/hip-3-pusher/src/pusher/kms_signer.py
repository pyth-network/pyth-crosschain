import boto3
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from eth_account.messages import encode_typed_data, _hash_eip191_message
from eth_keys.backends.native.ecdsa import N as SECP256K1_N
from eth_keys.datatypes import Signature
from eth_utils import keccak, to_hex
from hyperliquid.exchange import Exchange
from hyperliquid.utils.signing import get_timestamp_ms, action_hash, construct_phantom_agent, l1_payload
from loguru import logger
from pathlib import Path

from pusher.config import Config
from pusher.exception import PushError

SECP256K1_N_HALF = SECP256K1_N // 2


def _init_client():
    # AWS_DEFAULT_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY should be set as environment variables
    return boto3.client(
        "kms",
        # can specify an endpoint for e.g. LocalStack
        # endpoint_url="http://localhost:4566"
    )


class KMSSigner:
    def __init__(self, config: Config, publisher_exchanges: list[Exchange]):
        self.use_testnet = config.hyperliquid.use_testnet
        self.publisher_exchanges = publisher_exchanges

        # AWS client and public key load
        self.client = _init_client()
        try:
            self._load_public_key(config.kms.aws_kms_key_id_path)
        except Exception as e:
            logger.exception("Failed to load public key from KMS; it might be incorrectly configured; error: {}", repr(e))
            raise Exception("Failed to load public key from KMS") from e

    def _load_public_key(self, key_path: str):
        # Fetch public key once so we can derive address and check recovery id
        self.aws_kms_key_id = Path(key_path).read_text().strip()
        pubkey_der = self.client.get_public_key(KeyId=self.aws_kms_key_id)["PublicKey"]
        self.pubkey = serialization.load_der_public_key(pubkey_der)
        self._construct_pubkey_address_and_bytes()

    def _construct_pubkey_address_and_bytes(self):
        # Construct eth address to log
        numbers = self.pubkey.public_numbers()
        x = numbers.x.to_bytes(32, "big")
        y = numbers.y.to_bytes(32, "big")
        uncompressed = b"\x04" + x + y
        self.address = "0x" + keccak(uncompressed[1:])[-20:].hex()
        logger.info("public key loaded from KMS: {}", self.address)

        # Parse KMS public key into uncompressed secp256k1 bytes
        pubkey_bytes = self.pubkey.public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.UncompressedPoint,
        )
        # Strip leading 0x04 (uncompressed point indicator)
        self.raw_pubkey_bytes = pubkey_bytes[1:]

    def set_oracle(self, dex, oracle_pxs, all_mark_pxs, external_perp_pxs):
        timestamp = get_timestamp_ms()
        oracle_pxs_wire = sorted(list(oracle_pxs.items()))
        mark_pxs_wire = [sorted(list(mark_pxs.items())) for mark_pxs in all_mark_pxs]
        external_perp_pxs_wire = sorted(list(external_perp_pxs.items()))
        action = {
            "type": "perpDeploy",
            "setOracle": {
                "dex": dex,
                "oraclePxs": oracle_pxs_wire,
                "markPxs": mark_pxs_wire,
                "externalPerpPxs": external_perp_pxs_wire,
            },
        }
        signature = self.sign_l1_action(
            action=action,
            nonce=timestamp,
            is_mainnet=not self.use_testnet,
        )
        return self._send_update(action, signature, timestamp)

    def _send_update(self, action, signature, timestamp):
        for exchange in self.publisher_exchanges:
            try:
                return exchange._post_action(
                    action=action,
                    signature=signature,
                    nonce=timestamp,
                )
            except Exception as e:
                logger.exception("perp_deploy_set_oracle exception for endpoint: {} error: {}", exchange.base_url, repr(e))

        raise PushError("all push endpoints failed")

    def sign_l1_action(self, action, nonce, is_mainnet):
        hash = action_hash(action, vault_address=None, nonce=nonce, expires_after=None)
        phantom_agent = construct_phantom_agent(hash, is_mainnet)
        data = l1_payload(phantom_agent)
        structured_data = encode_typed_data(full_message=data)
        message_hash = _hash_eip191_message(structured_data)
        return self.sign_message(message_hash)

    def sign_message(self, message_hash: bytes) -> dict:
        # Send message hash to KMS for signing
        resp = self.client.sign(
            KeyId=self.aws_kms_key_id,
            Message=message_hash,
            MessageType="DIGEST",
            SigningAlgorithm="ECDSA_SHA_256",  # required for secp256k1
        )
        kms_signature = resp["Signature"]
        # Decode the KMS DER signature -> (r, s)
        r, s = decode_dss_signature(kms_signature)
        # Ethereum requires low-s form
        if s > SECP256K1_N_HALF:
            s = SECP256K1_N - s

        # Try both recovery ids
        for v in (0, 1):
            sig_obj = Signature(vrs=(v, r, s))
            recovered_pub = sig_obj.recover_public_key_from_msg_hash(message_hash)
            if recovered_pub.to_bytes() == self.raw_pubkey_bytes:
                return {
                    "r": to_hex(r),
                    "s": to_hex(s),
                    "v": v + 27,
                }
        raise ValueError("Could not recover public key; signature mismatch")
