import logging
import os
import json
import socketserver
import subprocess
import sys
from http.client import HTTPConnection


# A generic unprivileged payer account with funds
SOL_PAYER_KEYPAIR = os.environ.get(
    "SOL_PAYER_KEYPAIR", "/solana-secrets/solana-devnet.json"
)

# Settings specific to local devnet Pyth instance
PYTH = os.environ.get("PYTH", "./pyth")
PYTH_ADMIN = os.environ.get("PYTH_ADMIN", "./pyth_admin")
PYTH_KEY_STORE = os.environ.get("PYTH_KEY_STORE", "/home/pyth/.pythd")
PYTH_PROGRAM_KEYPAIR = os.environ.get(
    "PYTH_PROGRAM_KEYPAIR", f"{PYTH_KEY_STORE}/publish_key_pair.json"
)
PYTH_PUBLISHER_KEYPAIR = os.environ.get(
    "PYTH_PUBLISHER_KEYPAIR", f"{PYTH_KEY_STORE}/publish_key_pair.json"
)

# How long to sleep between mock Pyth price updates
PYTH_PUBLISHER_INTERVAL_SECS = float(os.environ.get("PYTH_PUBLISHER_INTERVAL_SECS", "5"))
PYTH_TEST_SYMBOL_COUNT = int(os.environ.get("PYTH_TEST_SYMBOL_COUNT", "11"))
PYTH_DYNAMIC_SYMBOL_COUNT = int(os.environ.get("PYTH_DYNAMIC_SYMBOL_COUNT", "3"))

# If above 0, adds a new test symbol periodically, waiting at least
# the given number of seconds in between
#
# NOTE: the new symbols are added in the HTTP endpoint used by the
# p2w-attest service in Tilt. You may need to wait to see p2w-attest
# pick up brand new symbols
PYTH_NEW_SYMBOL_INTERVAL_SECS = int(os.environ.get("PYTH_NEW_SYMBOL_INTERVAL_SECS", "30"))

PYTH_MAPPING_KEYPAIR = os.environ.get(
    "PYTH_MAPPING_KEYPAIR", f"{PYTH_KEY_STORE}/mapping_key_pair.json"
)

# SOL RPC settings
SOL_RPC_HOST = os.environ.get("SOL_RPC_HOST", "solana-devnet")
SOL_RPC_PORT = int(os.environ.get("SOL_RPC_PORT", 8899))
SOL_RPC_URL = os.environ.get(
    "SOL_RPC_URL", "http://{0}:{1}".format(SOL_RPC_HOST, SOL_RPC_PORT)
)

# A TCP port we open when a service is ready
READINESS_PORT = int(os.environ.get("READINESS_PORT", "2000"))


def run_or_die(args, die=True, debug=False, **kwargs):
    """
    Opinionated subprocess.run() call with fancy logging
    """
    args_readable = " ".join(args)
    print(f"CMD RUN\t{args_readable}", file=sys.stderr)
    sys.stderr.flush()
    ret = subprocess.run(args, text=True, **kwargs)

    if ret.returncode == 0:
        print(f"CMD OK\t{args_readable}", file=sys.stderr)
    else:
        print(f"CMD FAIL {ret.returncode}\t{args_readable}", file=sys.stderr)

    if debug:
        out = ret.stdout if ret.stdout is not None else "<not captured>"
        err = ret.stderr if ret.stderr is not None else "<not captured>"

        print(f"CMD STDOUT\n{out}", file=sys.stderr)
        print(f"CMD STDERR\n{err}", file=sys.stderr)

    sys.stderr.flush()

    if ret.returncode != 0:
        if die:
            sys.exit(ret.returncode)
        else:
            print(f'{"CMD DIE FALSE"}', file=sys.stderr)
            sys.stderr.flush()



    return ret


def pyth_run_or_die(subcommand, args=[], debug=False, **kwargs):
    """
    Pyth boilerplate in front of run_or_die.
    """
    return run_or_die(
        [PYTH, subcommand] + args + (["-d"] if debug else [])
        + ["-k", PYTH_KEY_STORE]
        + ["-r", SOL_RPC_HOST]
        + ["-c", "finalized"]
        + ["-x"], # These means to bypass transaction proxy server. In this setup it's not running and it's required to bypass
        **kwargs,
    )


def pyth_admin_run_or_die(subcommand, args=[], debug=False, **kwargs):
    """
    Pyth_admin boilerplate in front of run_or_die.
    """
    return run_or_die(
        [PYTH_ADMIN, subcommand] + args + (["-d"] if debug else [])
        + ["-n"] # These commands require y/n confirmation. This bypasses that
        + ["-k", PYTH_KEY_STORE]
        + ["-r", SOL_RPC_HOST]
        + ["-c", "finalized"],
        debug=debug,
        **kwargs,
    )


def sol_run_or_die(subcommand, args=[], **kwargs):
    """
    Solana boilerplate in front of run_or_die
    """
    return run_or_die(["solana", subcommand] + args + ["--url", SOL_RPC_URL], **kwargs)


def get_json(host, port, path):
    conn = HTTPConnection(host, port)
    conn.request("GET", path)
    res = conn.getresponse()

    # starstwith because the header value may include optional fields after (like charset)
    if res.getheader("Content-Type").startswith("application/json"):
        return json.load(res)
    else:
        logging.error(f"Error getting {host}:{port}{path} : Content-Type was not application/json")
        logging.error(f"HTTP response code: {res.getcode()}")
        logging.error(f"HTTP headers: {res.getheaders()}")
        logging.error(f"Message: {res.msg}")
        sys.exit(1)

def get_pyth_accounts(host, port):
    return get_json(host, port, "/")

class ReadinessTCPHandler(socketserver.StreamRequestHandler):
    def handle(self):
        """TCP black hole"""
        self.rfile.read(64)


def readiness():
    """
    Accept connections from readiness probe
    """
    with socketserver.TCPServer(
        ("0.0.0.0", READINESS_PORT), ReadinessTCPHandler
    ) as srv:
        print(f"Opening port {READINESS_PORT} for readiness TCP probe")
        srv.serve_forever()
