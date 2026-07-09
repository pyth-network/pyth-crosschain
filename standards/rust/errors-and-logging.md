# Rust errors and logging

## `anyhow` for services, `thiserror` for libraries

End-user applications and services can use a single error type throughout the code.
We use `anyhow` for that. Fine-grained error types are often not beneficial in
these applications because most of the time you just catch and log the error at a
certain level.

Libraries, on the other hand, often need to return a detailed error to the caller.
This is where fine-grained error types come in handy. Make sure they are well
formed:

- Error types should implement `Debug`, `Display`, and `Error`. When implementing
  `Error`, the `source()` method should be properly implemented. The easiest way to
  do these things is the `thiserror` crate and the `#[error]` and `#[source]`
  attributes it provides.
- If the location of the error can be ambiguous, consider adding a backtrace to it.
  For custom error types you have to do it manually by storing
  `std::backtrace::Backtrace` inside the error.

## Add relevant context to errors

The error message should contain relevant context that can help understand the
issue.

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

⛔ Bad:

```rust
let exponent = config.feeds.get(feed_id).context("missing feed")?.exponent;
```

✅ Good:

```rust
let exponent = config
    .feeds
    .get(feed_id)
    .with_context(|| {
        format!("missing feed {:?} in config", feed_id)
    })?
    .exponent;
```

## Preserve error sources

When wrapping another error or converting error type, preserve the error source
instead of converting it to `String`. Especially avoid calling `to_string()` on
`anyhow::Error` or formatting it with `{}` because it erases context and backtrace
information.

⛔ Bad (loses information about source errors and backtrace):

```rust
if let Err(err) = parse(data) {
    bail!("parsing failed: {err}");
}
// OR
parse(data).map_err(|err| format!("parsing failed: {err}"))?;
```

⛔ Better but still bad (preserves source errors and backtrace, but the error will
have two backtraces now):

```rust
if let Err(err) = parse(data) {
    bail!("parsing failed for {data:?}: {err:?}");
}
```

✅ Good (returns an error with proper source and backtrace):

```rust
parse(data).with_context(|| format!("failed to parse {data:?}"))?;
```

## Logging with `tracing`

Use `tracing` for logging. Log errors in a structured way so the source and
backtrace survive — pass the error as a field with `?err` (its `Debug`
representation) rather than interpolating its `Display` form into the message.

⛔ Bad (loses information about source errors and backtrace):

```rust
warn!(%err, ?data, "parsing failed");
// OR
warn!("parsing failed: {}", err);
```

✅ Good (records full information about the error in a structured way):

```rust
warn!(?err, ?data, "parsing failed");
```
