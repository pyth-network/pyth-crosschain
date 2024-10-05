#![doc = include_str!("../README.md")]
use proc_macro::TokenStream;

mod test;

/// Defines an end-to-end Stylus contract test that sets up `e2e::Account`s
/// based on the function's parameters.
///
/// # Examples
///
/// ```rust,ignore
/// #[e2e::test]
/// async fn foo(alice: Account, bob: Account) -> eyre::Result<()> {
///     let charlie = Account::new().await?;
///     // ...
/// }
/// ```
#[proc_macro_attribute]
pub fn test(attr: TokenStream, input: TokenStream) -> TokenStream {
    test::test(&attr, input)
}
