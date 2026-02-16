/// `Result<a, e>` represents success with value `a` or failure with error `e`.
pub type Result<a, e> {
  Ok(a)
  Err(e)
}

/// Checks that `Result` is `Ok`.
pub fn is_ok(self: Result<a, e>) -> Bool {
  when self is {
    Ok(_) -> True
    Err(_) -> False
  }
}

/// Checks that `Result` is `Err`.
pub fn is_err(self: Result<a, e>) -> Bool {
  when self is {
    Ok(_) -> False
    Err(_) -> True
  }
}

/// Discards value in `Ok`.
pub fn void(self: Result<a, e>) -> Result<Void, e> {
  when self is {
    Ok(_) -> Ok(Void)
    Err(e) -> Err(e)
  }
}

/// Applies function to value in `Ok`.
pub fn map(self: Result<a, e>, with: fn(a) -> b) -> Result<b, e> {
  when self is {
    Ok(a) -> Ok(with(a))
    Err(e) -> Err(e)
  }
}

/// Applies function to value in `Err`.
pub fn map_err(self: Result<a, e>, with: fn(e) -> i) -> Result<a, i> {
  when self is {
    Ok(a) -> Ok(a)
    Err(e) -> Err(with(e))
  }
}

pub fn and_then(self: Result<a, e>, then: fn(a) -> Result<b, e>) -> Result<b, e> {
  when self is {
    Ok(a) -> then(a)
    Err(e) -> Err(e)
  }
}

/// Only executes continuation if check succeeds, otherwise returns error. To be
/// used with backpassing syntax.
pub fn guard_then(
  check: Bool,
  err: e,
  then: fn(Void) -> Result<a, e>,
) -> Result<a, e> {
  if check {
    then(Void)
  } else {
    Err(err)
  }
}
