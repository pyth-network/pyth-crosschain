# Motsu (持つ) - Unit Testing for Stylus

This crate enables unit-testing for Stylus contracts. It abstracts away the
machinery necessary for writing tests behind a `#[motsu::test]` procedural
macro.

`motsu` means ["to hold"](https://jisho.org/word/%E6%8C%81%E3%81%A4) in
Japanese -- we hold a stylus in our hand.

## Usage

Annotate tests with `#[motsu::test]` instead of `#[test]` to get access to VM
affordances.

Note that we require contracts to implement `stylus_sdk::prelude::StorageType`.
This trait is typically implemented by default with `stylus_proc::sol_storage` macro.

```rust
#[cfg(test)]
mod tests {
    use contracts::token::erc20::Erc20;

    #[motsu::test]
    fn reads_balance(contract: Erc20) {
        let balance = contract.balance_of(Address::ZERO); // Access storage.
        assert_eq!(balance, U256::ZERO);
    }
}
```

Annotating a test function that accepts no parameters will make `#[motsu::test]`
behave the same as `#[test]`.

```rust,ignore
#[cfg(test)]
mod tests {
    #[motsu::test]
     fn t() { // If no params, it expands to a `#[test]`.
        // ...
    }
}
```

Note that currently, test suites using `motsu::test` will run serially because
of global access to storage.

### Notice

We maintain this crate on a best-effort basis. We use it extensively on our own
tests, so we will add here any symbols we may need. However, since we expect
this to be a temporary solution, don't expect us to address all requests.

That being said, please do open an issue to start a discussion, keeping in mind
our [code of conduct] and [contribution guidelines].

[code of conduct]: ../../CODE_OF_CONDUCT.md

[contribution guidelines]: ../../CONTRIBUTING.md

## Security

Refer to our [Security Policy](../../SECURITY.md) for more details.
