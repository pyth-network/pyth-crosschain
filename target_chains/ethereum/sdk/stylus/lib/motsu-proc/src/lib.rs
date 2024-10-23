//! Procedural macro definitions used in `motsu`.
use proc_macro::TokenStream;

/// Shorthand to print nice errors.
///
/// Note that it's defined before the module declarations.
macro_rules! error {
    ($tokens:expr, $($msg:expr),+ $(,)?) => {{
        let error = syn::Error::new(syn::spanned::Spanned::span(&$tokens), format!($($msg),+));
        return error.to_compile_error().into();
    }};
    (@ $tokens:expr, $($msg:expr),+ $(,)?) => {{
        return Err(syn::Error::new(syn::spanned::Spanned::span(&$tokens), format!($($msg),+)))
    }};
}

mod test;

/// Defines a unit test that provides access to Stylus' execution context.
///
/// Internally, this is a thin wrapper over `#[test]` that gives access to
/// affordances like contract storage and `msg::sender`. If you don't need
/// them, you can pass no arguments to the test function or simply use
/// `#[test]` instead of `#[motsu::test]`.
///
/// # Examples
///
/// ```rust,ignore
/// #[cfg(test)]
/// mod tests {
///     #[motsu::test]
///     fn reads_balance(contract: Erc20) {
///        let balance = contract.balance_of(Address::ZERO);
///        assert_eq!(U256::ZERO, balance);
///
///        let owner = msg::sender();
///        let one = U256::from(1);
///        contract._balances.setter(owner).set(one);
///        let balance = contract.balance_of(owner);
///        assert_eq!(one, balance);
///     }
/// }
/// ```
///
/// ```rust,ignore
/// #[cfg(test)]
/// mod tests {
///     #[motsu::test]
///     fn t() { // If no params, it expands to a `#[test]`.
///         ...
///     }
/// }
/// ```
#[proc_macro_attribute]
pub fn test(attr: TokenStream, input: TokenStream) -> TokenStream {
    test::test(&attr, input)
}
