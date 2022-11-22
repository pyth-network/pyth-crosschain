# This script prepares a local Squads multisig deployment for use with
# the multisig-wh-message-builder
from pyth_utils import *

MSG_BUILDER_CMD_PREFIX = "npm run start --".split(" ")
MSG_BUILDER_DIR = "/root/pyth/multisig-wh-message-builder"

def msg_builder_run_or_die(args = [], debug=False, **kwargs):
    """
    Message builder boilerplate in front of run_or_die()
    """
    return run_or_die(
        MSG_BUILDER_CMD_PREFIX + args, cwd=MSG_BUILDER_DIR, **kwargs)

# create a Multisig Vault
msg_builder_run_or_die(capture_output=True)


pyth_utils.readiness()
