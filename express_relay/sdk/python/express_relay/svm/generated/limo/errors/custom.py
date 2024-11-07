import typing
from anchorpy.error import ProgramError


class OrderCanNotBeCanceled(ProgramError):
    def __init__(self) -> None:
        super().__init__(6000, "Order can't be canceled")

    code = 6000
    name = "OrderCanNotBeCanceled"
    msg = "Order can't be canceled"


class OrderNotActive(ProgramError):
    def __init__(self) -> None:
        super().__init__(6001, "Order not active")

    code = 6001
    name = "OrderNotActive"
    msg = "Order not active"


class InvalidAdminAuthority(ProgramError):
    def __init__(self) -> None:
        super().__init__(6002, "Invalid admin authority")

    code = 6002
    name = "InvalidAdminAuthority"
    msg = "Invalid admin authority"


class InvalidPdaAuthority(ProgramError):
    def __init__(self) -> None:
        super().__init__(6003, "Invalid pda authority")

    code = 6003
    name = "InvalidPdaAuthority"
    msg = "Invalid pda authority"


class InvalidConfigOption(ProgramError):
    def __init__(self) -> None:
        super().__init__(6004, "Invalid config option")

    code = 6004
    name = "InvalidConfigOption"
    msg = "Invalid config option"


class InvalidOrderOwner(ProgramError):
    def __init__(self) -> None:
        super().__init__(6005, "Order owner account is not the order owner")

    code = 6005
    name = "InvalidOrderOwner"
    msg = "Order owner account is not the order owner"


class OutOfRangeIntegralConversion(ProgramError):
    def __init__(self) -> None:
        super().__init__(6006, "Out of range integral conversion attempted")

    code = 6006
    name = "OutOfRangeIntegralConversion"
    msg = "Out of range integral conversion attempted"


class InvalidFlag(ProgramError):
    def __init__(self) -> None:
        super().__init__(6007, "Invalid boolean flag, valid values are 0 and 1")

    code = 6007
    name = "InvalidFlag"
    msg = "Invalid boolean flag, valid values are 0 and 1"


class MathOverflow(ProgramError):
    def __init__(self) -> None:
        super().__init__(6008, "Mathematical operation with overflow")

    code = 6008
    name = "MathOverflow"
    msg = "Mathematical operation with overflow"


class OrderInputAmountInvalid(ProgramError):
    def __init__(self) -> None:
        super().__init__(6009, "Order input amount invalid")

    code = 6009
    name = "OrderInputAmountInvalid"
    msg = "Order input amount invalid"


class OrderOutputAmountInvalid(ProgramError):
    def __init__(self) -> None:
        super().__init__(6010, "Order input amount invalid")

    code = 6010
    name = "OrderOutputAmountInvalid"
    msg = "Order input amount invalid"


class InvalidHostFee(ProgramError):
    def __init__(self) -> None:
        super().__init__(6011, "Host fee bps must be between 0 and 10000")

    code = 6011
    name = "InvalidHostFee"
    msg = "Host fee bps must be between 0 and 10000"


class IntegerOverflow(ProgramError):
    def __init__(self) -> None:
        super().__init__(6012, "Conversion between integers failed")

    code = 6012
    name = "IntegerOverflow"
    msg = "Conversion between integers failed"


class InvalidTipBalance(ProgramError):
    def __init__(self) -> None:
        super().__init__(6013, "Tip balance less than accounted tip")

    code = 6013
    name = "InvalidTipBalance"
    msg = "Tip balance less than accounted tip"


class InvalidTipTransferAmount(ProgramError):
    def __init__(self) -> None:
        super().__init__(6014, "Tip transfer amount is less than expected")

    code = 6014
    name = "InvalidTipTransferAmount"
    msg = "Tip transfer amount is less than expected"


class InvalidHostTipBalance(ProgramError):
    def __init__(self) -> None:
        super().__init__(6015, "Host tup amount is less than accounted for")

    code = 6015
    name = "InvalidHostTipBalance"
    msg = "Host tup amount is less than accounted for"


CustomError = typing.Union[
    OrderCanNotBeCanceled,
    OrderNotActive,
    InvalidAdminAuthority,
    InvalidPdaAuthority,
    InvalidConfigOption,
    InvalidOrderOwner,
    OutOfRangeIntegralConversion,
    InvalidFlag,
    MathOverflow,
    OrderInputAmountInvalid,
    OrderOutputAmountInvalid,
    InvalidHostFee,
    IntegerOverflow,
    InvalidTipBalance,
    InvalidTipTransferAmount,
    InvalidHostTipBalance,
]
CUSTOM_ERROR_MAP: dict[int, CustomError] = {
    6000: OrderCanNotBeCanceled(),
    6001: OrderNotActive(),
    6002: InvalidAdminAuthority(),
    6003: InvalidPdaAuthority(),
    6004: InvalidConfigOption(),
    6005: InvalidOrderOwner(),
    6006: OutOfRangeIntegralConversion(),
    6007: InvalidFlag(),
    6008: MathOverflow(),
    6009: OrderInputAmountInvalid(),
    6010: OrderOutputAmountInvalid(),
    6011: InvalidHostFee(),
    6012: IntegerOverflow(),
    6013: InvalidTipBalance(),
    6014: InvalidTipTransferAmount(),
    6015: InvalidHostTipBalance(),
}


def from_code(code: int) -> typing.Optional[CustomError]:
    maybe_err = CUSTOM_ERROR_MAP.get(code)
    if maybe_err is None:
        return None
    return maybe_err
