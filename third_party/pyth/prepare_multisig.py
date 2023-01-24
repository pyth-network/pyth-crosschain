# This script prepares a local Squads multisig deployment for use with
# the multisig_wh_message_builder
import errno
import os
import sys

from pyth_utils import *

MULTISIG_SCRIPT_CMD_PREFIX = "npm run start --".split(" ")
MULTISIG_SCRIPT_DIR = os.environ.get("MULTISIG_SCRIPT_DIR", "/root/pyth/multisig_wh_message_builder")

MESH_KEY_DIR = "/solana-secrets/squads/"
MESH_PROGRAM_ADDR = "SMPLVC8MxZ5Bf5EfF7PaMiTCxoBAcmkbM2vkrvMK8ho"
MESH_VAULT_EXT_AUTHORITY_KEY_PATH = MESH_KEY_DIR + "external_authority.json"

ALICE_KEY_PATH = MESH_KEY_DIR + "member_alice.json"
BOB_KEY_PATH = MESH_KEY_DIR + "member_bob.json"

create_key_addr = "73UuSY2yXat7h7T49MMGg8TiHPqJJKKVc33DmC4b41Hf" # The person that instantiated the multisig on mainnet used this create key, it never needs to sign but we're using it to match mainnet
ext_authority_addr = sol_run_or_die("address", ["--keypair", MESH_VAULT_EXT_AUTHORITY_KEY_PATH], capture_output=True).stdout.strip()

alice_addr = sol_run_or_die("address", ["--keypair", ALICE_KEY_PATH], capture_output=True).stdout.strip()
bob_addr = sol_run_or_die("address", ["--keypair", BOB_KEY_PATH], capture_output=True).stdout.strip()

# wrap run_or_die in msg builder common cli args
def msg_builder_run_or_die(args = [], debug=False, **kwargs):
    """
    Message builder boilerplate in front of run_or_die()
    """
    return run_or_die(
        MULTISIG_SCRIPT_CMD_PREFIX + args, cwd=MULTISIG_SCRIPT_DIR, debug=debug, **kwargs)

# create a Multisig Vault
res = msg_builder_run_or_die([
                        "init-vault",
                        "-k", create_key_addr,
                        "-x", ext_authority_addr,
                        "-p", SOL_PAYER_KEYPAIR,
                        "-c", "localdevnet",
                        "-r", SOL_RPC_URL,
                        "-i", f"{alice_addr},{bob_addr}",
                        "-t", "1", # 1/3 threshold
                        ],
                             capture_output=True, debug=True, die=False)

if res.returncode == errno.EEXIST:
    print("WARNING: Skipping vault creation and testing, received EEXIST from script", file=sys.stderr)
elif res.returncode != 0:
    print(f"ERROR: unexpected failure with code {res.returncode}", file=sys.stderr)
    sys.exit(res.returncode)
else:
    print("Vault created, starting test routine", file=sys.stderr)
    # TODO(2022-12-08): Add test scenarios

sys.stderr.flush()

readiness()
