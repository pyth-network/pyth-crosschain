import typing
import re
from solders.transaction_status import (
    InstructionErrorCustom,
    TransactionErrorInstructionError,
)
from solana.rpc.core import RPCException
from solders.rpc.errors import SendTransactionPreflightFailureMessage
from anchorpy.error import extract_code_and_logs
from ..program_id import PROGRAM_ID
from . import anchor
from . import custom


def from_code(code: int) -> typing.Union[custom.CustomError, anchor.AnchorError, None]:
    return custom.from_code(code) if code >= 6000 else anchor.from_code(code)


error_re = re.compile(r"Program (\w+) failed: custom program error: (\w+)")


def from_tx_error(
    error: RPCException,
) -> typing.Union[anchor.AnchorError, custom.CustomError, None]:
    err_info = error.args[0]
    extracted = extract_code_and_logs(err_info, PROGRAM_ID)
    if extracted is None:
        return None
    return from_code(extracted[0])
