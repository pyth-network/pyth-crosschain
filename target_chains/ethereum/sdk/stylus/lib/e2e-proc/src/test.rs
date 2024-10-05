use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, FnArg};

/// Shorthand to print nice errors.
macro_rules! error {
    ($tokens:expr, $($msg:expr),+ $(,)?) => {{
        let error = syn::Error::new(syn::spanned::Spanned::span(&$tokens), format!($($msg),+));
        return error.to_compile_error().into();
    }};
    (@ $tokens:expr, $($msg:expr),+ $(,)?) => {{
        return Err(syn::Error::new(syn::spanned::Spanned::span(&$tokens), format!($($msg),+)))
    }};
}

/// Defines an end-to-end test that injects test accounts through parameters.
///
/// For more information see [`crate::test`].
pub(crate) fn test(_attr: &TokenStream, input: TokenStream) -> TokenStream {
    let item_fn = parse_macro_input!(input as syn::ItemFn);
    let attrs = &item_fn.attrs;
    let sig = &item_fn.sig;
    let fn_name = &sig.ident;
    let fn_return_type = &sig.output;
    let fn_stmts = &item_fn.block.stmts;
    let fn_args = &sig.inputs;

    let account_declarations = fn_args.into_iter().map(|arg| {
        let FnArg::Typed(arg) = arg else {
            error!(arg, "unexpected receiver argument in test signature");
        };
        let account_arg_binding = &arg.pat;
        let account_ty = &arg.ty;
        quote! {
            let #account_arg_binding = #account_ty::new().await?;
        }
    });
    quote! {
        #( #attrs )*
        #[tokio::test]
        async fn #fn_name() #fn_return_type {
            #( #account_declarations )*
            #( #fn_stmts )*
        }
    }
    .into()
}
