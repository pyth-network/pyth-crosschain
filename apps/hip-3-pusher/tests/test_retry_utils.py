import asyncio
from types import SimpleNamespace

import pytest

from pusher.exception import StaleConnectionError
from pusher.retry import (
    _log_before_sleep,
    _log_exhaustion_and_reraise,
    run_with_listener_retry,
)


def _retry_state(
    *,
    attempt_number: int,
    exc: BaseException | None = None,
    sleep_seconds: float | None = None,
) -> SimpleNamespace:
    outcome = None
    if exc is not None:
        outcome = SimpleNamespace(exception=lambda: exc)
    next_action = None
    if sleep_seconds is not None:
        next_action = SimpleNamespace(sleep=sleep_seconds)
    return SimpleNamespace(
        attempt_number=attempt_number,
        outcome=outcome,
        next_action=next_action,
    )


def test_log_before_sleep_emits_attempt_metadata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[tuple[str, tuple[object, ...]]] = []

    def fake_info(message: str, *args: object) -> None:
        captured.append((message, args))

    monkeypatch.setattr("pusher.retry.logger.info", fake_info)

    retry_state = _retry_state(
        attempt_number=3,
        exc=StaleConnectionError("socket stale"),
        sleep_seconds=1.0,
    )
    _log_before_sleep(retry_state, "HermesListener", "wss://hermes.example")

    assert len(captured) == 1
    message, args = captured[0]
    assert "retrying endpoint" in message
    assert args[0] == "HermesListener"
    assert args[1] == "wss://hermes.example"
    assert args[2] == 3
    assert args[3] == 1.0
    assert args[4] == "StaleConnectionError"


def test_log_exhaustion_and_reraise_raises_last_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[tuple[str, tuple[object, ...]]] = []

    def fake_error(message: str, *args: object) -> None:
        captured.append((message, args))

    monkeypatch.setattr("pusher.retry.logger.error", fake_error)

    retry_state = _retry_state(
        attempt_number=5,
        exc=StaleConnectionError("retries exhausted"),
    )
    with pytest.raises(StaleConnectionError, match="retries exhausted"):
        _log_exhaustion_and_reraise(
            retry_state,
            "LazerListener",
            "wss://lazer.example",
        )

    assert len(captured) == 1
    message, args = captured[0]
    assert "exhausted retries" in message
    assert args[0] == "LazerListener"
    assert args[1] == "wss://lazer.example"
    assert args[2] == 5


def test_log_exhaustion_and_reraise_with_none_exception_raises_runtime_error() -> None:
    retry_state = _retry_state(attempt_number=2, exc=None)
    with pytest.raises(RuntimeError, match="but no exception was captured"):
        _log_exhaustion_and_reraise(
            retry_state,
            "HyperliquidListener",
            "wss://hyperliquid.example",
        )


def test_run_with_listener_retry_returns_operation_result() -> None:
    async def operation() -> str:
        return "ok"

    result = asyncio.run(
        run_with_listener_retry(
            operation=operation,
            listener_name="HyperliquidListener",
            endpoint="wss://hyperliquid.example",
            stop_after_attempt_count=7,
        )
    )

    assert result == "ok"
