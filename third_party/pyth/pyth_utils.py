import logging
import socketserver
import subprocess
import sys


def run_or_die(args, die=True, **kwargs):
    """
    Opinionated subprocess.run() call with fancy logging
    """
    args_readable = " ".join(args)
    logging.debug(f"CMD RUN: {args_readable}")
    ret = subprocess.run(args, text=True, **kwargs)

    if ret.returncode != 0:
        logging.error(f"Return code is: {ret.returncode}")
        if die:
            sys.exit(ret.returncode)
        else:
            logging.warn("CMD DIE FALSE")
    else:
        logging.debug(f"CMD OK: {args_readable}")
    return ret


def sol_run_or_die(subcommand, args=[], **kwargs):
    """
    Solana boilerplate in front of run_or_die
    """
    return run_or_die(["solana", subcommand] + args, **kwargs)


class ReadinessTCPHandler(socketserver.StreamRequestHandler):
    def handle(self):
        """TCP black hole"""
        self.rfile.read(64)


def readiness(port):
    """
    Accept connections from readiness probe
    """
    with socketserver.TCPServer(("0.0.0.0", port), ReadinessTCPHandler) as srv:
        srv.serve_forever()
