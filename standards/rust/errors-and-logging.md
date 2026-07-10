# Rust errors and logging

## `anyhow` for services, `thiserror` for libraries

Services can use a single error type throughout, and `anyhow` is ideal: fine-grained
types rarely help when you mostly catch and log at a certain level.

Libraries often need to return detailed errors, where fine-grained types help. Make
them well formed:

- Implement `Debug`, `Display`, and `Error`, with `source()` properly implemented.
  The `thiserror` crate and its `#[error]` and `#[source]` attributes make this easy.
- If the error location can be ambiguous, add a backtrace. For custom types, store
  `std::backtrace::Backtrace` inside the error.

## Add relevant context to errors

The error message should carry context that helps understand the issue.

⛔ Bad:

```rust
let timestamp = args.timestamp.try_into()?;
```

✅ Good (using `anyhow::Context`):

```rust
let timestamp = args
    .timestamp
    .try_into()
    .with_context(|| {
        format!("invalid timestamp received from Hermes: {:?}", args.timestamp)
    })?;
```

## Preserve error sources

When wrapping or converting an error, preserve the source instead of converting it
to `String`. Avoid `to_string()` on `anyhow::Error` or formatting it with `{}`, as
that erases context and backtrace information.

⛔ Bad (loses source errors and backtrace):

```rust
parse(data).map_err(|err| format!("parsing failed: {err}"))?;
```

✅ Good (returns an error with proper source and backtrace):

```rust
parse(data).with_context(|| format!("failed to parse {data:?}"))?;
```

## Logging with `tracing`

Use `tracing` for logging. Log errors structurally so the source and backtrace
survive — pass the error as a field with `?err` (its `Debug` form) rather than
interpolating its `Display` form into the message.

⛔ Bad (loses source errors and backtrace):

```rust
warn!("parsing failed: {}", err);
```

✅ Good (records full error information structurally):

```rust
warn!(?err, ?data, "parsing failed");
```
