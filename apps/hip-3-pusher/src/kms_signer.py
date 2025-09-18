import boto3
from asn1crypto import core
from eth_account.messages import encode_typed_data, _hash_eip191_message
from eth_keys.datatypes import Signature
from eth_utils import keccak, to_hex
from hyperliquid.exchange import Exchange
from hyperliquid.utils.constants import TESTNET_API_URL, MAINNET_API_URL
from hyperliquid.utils.signing import get_timestamp_ms, action_hash, construct_phantom_agent, l1_payload
from loguru import logger


class KMSSigner:
    def __init__(self, key_id, aws_region_name, use_testnet):
        url = TESTNET_API_URL if use_testnet else MAINNET_API_URL
        self.oracle_publisher_exchange: Exchange = Exchange(wallet=None, base_url=url)

        self.key_id = key_id
        self.client = boto3.client("kms", region_name=aws_region_name)
        # Fetch public key once so we can derive address and check recovery id
        pub_der = self.client.get_public_key(KeyId=key_id)["PublicKey"]

        from cryptography.hazmat.primitives import serialization
        pub = serialization.load_der_public_key(pub_der)
        numbers = pub.public_numbers()
        x = numbers.x.to_bytes(32, "big")
        y = numbers.y.to_bytes(32, "big")
        uncompressed = b"\x04" + x + y
        self.public_key_bytes = uncompressed
        self.address = "0x" + keccak(uncompressed[1:])[-20:].hex()
        logger.info("KMSSigner address: {}", self.address)

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
        signed = self.sign_message(message_hash)
        return {"r": to_hex(signed["r"]), "s": to_hex(signed["s"]), "v": signed["v"]}

    def sign_message(self, message_hash: bytes):
        resp = self.client.sign(
            KeyId=self.key_id,
            Message=message_hash,
            MessageType="DIGEST",
            SigningAlgorithm="ECDSA_SHA_256",  # required for secp256k1
        )
        der_sig = resp["Signature"]

        seq = core.Sequence.load(der_sig)
        r = int(seq[0].native)
        s = int(seq[1].native)

        for recovery_id in (0, 1):
            candidate = Signature(vrs=(recovery_id, r, s))
            pubkey = candidate.recover_public_key_from_msg_hash(message_hash)
            if pubkey.to_bytes() == self.public_key_bytes:
                v = recovery_id + 27
                break
        else:
            raise ValueError("Failed to determine recovery id")

        return {
            "r": r,
            "s": s,
            "v": v,
            "signature": Signature(vrs=(v, r, s)).to_bytes().hex(),
        }
