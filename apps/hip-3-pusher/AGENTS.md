# Repository Guidelines

## Project Structure & Module Organization
Application code lives in `src/pusher/` with listeners (`lazer_listener.py`, `hermes_listener.py`, `hyperliquid_listener.py`), shared config (`config.py`), state (`price_state.py`), and retry/error helpers (`retry.py`, `exception.py`). Executable entrypoints and scripts live in `src/pusher/main.py` and `src/scripts/`. Tests live in `tests/` and are expected to cover listener reconnect behavior and retry edge cases.

## Build, Test, and Development Commands
- `uv run ruff format src/ tests/`: run formatter exactly as CI does.
- `uv run ruff check src/ tests/`: run lint checks (includes import sorting and type-checking import rules).
- `uv run mypy src/`: run strict type checks for production code.
- `uv run pytest tests/`: run the full app test suite.
- `python -m pytest tests/test_retry_utils.py tests/test_listener_reconnect_behavior.py`: fast focused verification for retry/listener changes.
- `uv lock`: regenerate `uv.lock` when dependencies or project metadata changes require lockfile updates.

## Coding Style & Naming Conventions
Use Python 3.13 style with fully typed function signatures in `src/`. Keep modules snake_case and classes PascalCase. Prefer explicit reconnect exceptions over sentinel return values in listeners. For logging, use `logger.exception(...)` where traceback context is useful. Keep retry/reconnect log levels intentional: expected reconnect events should be `INFO`, not `WARNING`.

## CI-Critical Reliability Rules
- Do not rely on untyped tenacity decorators in strict mypy paths; use typed retry execution patterns (for this app, `run_with_listener_retry` in `src/pusher/retry.py`).
- Avoid returning values from `-> None` functions (for example, `return await ...`); call and `await` directly.
- Keep retry exhaustion behavior explicit: never allow silent `None` returns from retry callbacks.
- Treat stale/timeout/connection-closed/decode failures as reconnect triggers; do not swallow them in broad `except Exception` handlers.
- If a websocket payload decode fails (`json.JSONDecodeError`), raise reconnect-triggering exceptions rather than looping forever on the same connection.

## Testing Guidelines
When editing listener/retry logic, run all four CI gate commands before pushing:
1. `uv run ruff format src/ tests/`
2. `uv run ruff check src/ tests/`
3. `uv run mypy src/`
4. `uv run pytest tests/`

Add or update regression tests under `tests/` for:
- retry hooks (`before_sleep`, exhaustion callback behavior)
- stale channel propagation
- decode-error reconnect behavior across listeners

## Commit & Pull Request Guidelines
Use concise conventional-style messages (`fix(hip-3-pusher): ...`). Keep PR scope focused on one behavioral change family (retry, parsing, metrics, etc.). In PR descriptions, include the exact verification commands run and mention any CI-sensitive typing or lint decisions. If dependency metadata or version changes affect lock resolution, run `uv lock` and commit the resulting `uv.lock` update in the same PR.

## Security & Configuration Tips
Do not commit secrets or tokens from runtime configs. Keep local caches and generated artifacts out of git (for example, `.hypothesis/` should remain ignored). Validate `git status` before commit to avoid accidentally staging environment-specific files.
