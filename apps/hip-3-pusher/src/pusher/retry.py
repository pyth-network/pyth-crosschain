from collections.abc import Awaitable, Callable
from typing import NoReturn, TypeVar

from loguru import logger
from tenacity import (
    AsyncRetrying,
    RetryCallState,
    retry_if_exception_type,
    stop_after_attempt,
    wait_fixed,
)

T = TypeVar("T")


def _log_before_sleep(
    retry_state: RetryCallState,
    listener_name: str,
    endpoint: str,
) -> None:
    exc = retry_state.outcome.exception() if retry_state.outcome is not None else None
    exc_type = type(exc).__name__ if exc is not None else "UnknownError"
    sleep_seconds = (
        retry_state.next_action.sleep if retry_state.next_action is not None else None
    )
    logger.info(
        "{} retrying endpoint={} attempt={} next_sleep_seconds={} exception_type={} exception={}",
        listener_name,
        endpoint,
        retry_state.attempt_number,
        sleep_seconds,
        exc_type,
        repr(exc),
    )


def _log_exhaustion_and_reraise(
    retry_state: RetryCallState,
    listener_name: str,
    endpoint: str,
) -> NoReturn:
    exc = retry_state.outcome.exception() if retry_state.outcome is not None else None
    if exc is None:
        exc = RuntimeError(
            f"{listener_name} exhausted retries for endpoint={endpoint}, "
            "but no exception was captured by retry state"
        )
    logger.error(
        "{} exhausted retries for endpoint={} after {} attempts; last_exception={}",
        listener_name,
        endpoint,
        retry_state.attempt_number,
        repr(exc),
    )
    raise exc


async def run_with_listener_retry(
    operation: Callable[[], Awaitable[T]],
    listener_name: str,
    endpoint: str,
    stop_after_attempt_count: int,
) -> T:
    def before_sleep(retry_state: RetryCallState) -> None:
        _log_before_sleep(retry_state, listener_name, endpoint)

    def retry_error_callback(retry_state: RetryCallState) -> NoReturn:
        _log_exhaustion_and_reraise(retry_state, listener_name, endpoint)

    async for attempt in AsyncRetrying(
        retry=retry_if_exception_type(Exception),
        wait=wait_fixed(1),
        stop=stop_after_attempt(stop_after_attempt_count),
        before_sleep=before_sleep,
        retry_error_callback=retry_error_callback,
        reraise=True,
    ):
        with attempt:
            return await operation()

    raise RuntimeError("Retry loop completed without result or exception")
