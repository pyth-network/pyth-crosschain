import boto3
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from eth_account.messages import encode_typed_data, _hash_eip191_message
from eth_keys.backends.native.ecdsa import N as SECP256K1_N
from eth_keys.datatypes import Signature
from eth_utils import keccak, to_hex
from hyperliquid.exchange import Exchange
from hyperliquid.utils.constants import TESTNET_API_URL, MAINNET_API_URL
from hyperliquid.utils.signing import get_timestamp_ms, action_hash, construct_phantom_agent, l1_payload
from loguru import logger

from pusher.config import Config

SECP256K1_N_HALF = SECP256K1_N // 2


class KMSSigner:
    def __init__(self, config: Config):
        use_testnet = config.hyperliquid.use_testnet
        url = TESTNET_API_URL if use_testnet else MAINNET_API_URL
        self.oracle_publisher_exchange: Exchange = Exchange(wallet=None, base_url=url)
        self.client = self._init_client(config)

        # Fetch public key once so we can derive address and check recovery id
        key_path = config.kms.key_path
        self.key_id = open(key_path, "r").read().strip()
        self.pubkey_der = self.client.get_public_key(KeyId=self.key_id)["PublicKey"]
        # Construct eth address to log
        pub = serialization.load_der_public_key(self.pubkey_der)
        numbers = pub.public_numbers()
        x = numbers.x.to_bytes(32, "big")
        y = numbers.y.to_bytes(32, "big")
        uncompressed = b"\x04" + x + y
        self.public_key_bytes = uncompressed
        self.address = "0x" + keccak(uncompressed[1:])[-20:].hex()
        logger.info("KMSSigner address: {}", self.address)

    def _init_client(self, config):
        aws_region_name = config.kms.aws_region_name
        access_key_id_path = config.kms.access_key_id_path
        access_key_id = open(access_key_id_path, "r").read().strip()
        secret_access_key_path = config.kms.secret_access_key_path
        secret_access_key = open(secret_access_key_path, "r").read().strip()

        return boto3.client(
            "kms",
            region_name=aws_region_name,
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            # can specify an endpoint for e.g. LocalStack
            # endpoint_url="http://localhost:4566"
        )

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
            action,
            timestamp,
            self.oracle_publisher_exchange.base_url == MAINNET_API_URL,
        )
        return self.oracle_publisher_exchange._post_action(
            action,
            signature,
            timestamp,
        )

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
            KeyId=self.key_id,
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
        # Parse KMS public key into uncompressed secp256k1 bytes
        # TODO: Pull this into init
        pubkey = serialization.load_der_public_key(self.pubkey_der)
        pubkey_bytes = pubkey.public_bytes(
            serialization.Encoding.X962,
            serialization.PublicFormat.UncompressedPoint,
        )
        # Strip leading 0x04 (uncompressed point indicator)
        raw_pubkey_bytes = pubkey_bytes[1:]
        # Try both recovery ids
        for v in (0, 1):
            sig_obj = Signature(vrs=(v, r, s))
            recovered_pub = sig_obj.recover_public_key_from_msg_hash(message_hash)
            if recovered_pub.to_bytes() == raw_pubkey_bytes:
                return {
                    "r": to_hex(r),
                    "s": to_hex(s),
                    "v": v + 27,
                }
        raise ValueError("Could not recover public key; signature mismatch")
