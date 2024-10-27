# Engineering Guidelines

## Testing

Code must be thoroughly tested with quality unit tests.

We defer to the [Moloch Testing Guide] for specific recommendations, though
not all of it is relevant here, since this is a Rust project. Note the
introduction:

> Tests should be written, not only to verify correctness of the target code,
> but to be comprehensively reviewed by other programmers. Therefore, for
> mission critical Solidity code, the quality of the tests are just as
> important (if not more so) than the code itself, and should be written with
> the highest standards of clarity and elegance.

Every addition or change to the code must come with relevant and comprehensive
tests.

Refactors should avoid simultaneous changes to tests.

Flaky tests are not acceptable.

The test suite should run automatically for every change in the repository, and
in pull requests tests must pass before merging.

The test suite coverage must be kept as close to 100% as possible, enforced in
pull requests.

In some cases unit tests may be insufficient and complementary techniques
should be used:

1. Property-based tests (aka. fuzzing) for math-heavy code.
2. Formal verification for state machines.

[Moloch Testing Guide]: https://github.com/MolochVentures/moloch/tree/master/test#readme

## Peer review

All changes must be submitted through pull requests and go through peer code
review.

The review must be approached by the reviewer in a similar way as if it was an
audit of the code in question (but importantly it is not a substitute for and
should not be considered an audit).

Reviewers should enforce code and project guidelines.

External contributions must be reviewed separately by multiple maintainers.

## Code style

Rust code should be written in a consistent format enforced by `rustfmt`,
following the official [The Rust Style Guide]. See below for further
[Rust Conventions](#rust-conventions).

The code should be simple and straightforward, prioritizing readability and
understandability. Consistency and predictability should be maintained across
the codebase. In particular, this applies to naming, which should be
systematic, clear, and concise.

Sometimes these guidelines may be broken if doing so brings significant
efficiency gains, but explanatory comments should be added.

The following code guidelines will help make code review smoother:

### Use of `unwrap` and `expect`

Use `unwrap` only in either of three circumstances:

- Based on manual static analysis, you've concluded that it's impossible for
  the code to panic; so unwrapping is _safe_. An example would be:

```rust
let list = vec![a, b, c];
let first = list.first().unwrap();
```

- The panic caused by `unwrap` would indicate a bug in the software, and it
  would be impossible to continue in that case.
- The `unwrap` is part of test code, ie. `cfg!(test)` is `true`.

In the first and second case, document `unwrap` call sites with a comment
prefixed with `SAFETY:` that explains why it's safe to unwrap, eg.

```rust
// SAFETY: Node IDs are valid ref strings.
let r = RefString::try_from(node.to_string()).unwrap();
```

Use `expect` only if the function expects certain invariants that were not met,
either due to bad inputs, or a problem with the environment; and include the
expectation in the message. For example:

```rust
logger::init(log::Level::Debug).expect("logger must only be initialized once");
```

### Module imports

Imports are organized in groups, from least specific to more specific:

```rust
use std::collections::HashMap; // First, `std` imports.
use std::process;
use std::time;

use git_ref_format as format; // Then, external dependencies.
use once_cell::sync::Lazy;

use crate::crypto::PublicKey; // Finally, local crate imports.
use crate::storage::refs::Refs;
use crate::storage::RemoteId;
```

This is enforced by `rustfmt`. Note that this is a `nightly` feature.

### Variable naming

Use short 1-letter names when the variable scope is only a few lines, or the
context is
obvious, eg.

```rust
if let Some(e) = result.err() {
...
}
```

Use 1-word names for function parameters or variables that have larger scopes:

```rust
pub fn commit(repo: &Repository, sig: &Signature) -> Result<Commit, Error> {
    ...
}
```

Use the most descriptive names for globals:

```rust
pub const KEEP_ALIVE_DELTA: LocalDuration = LocalDuration::from_secs(30);
```

### Function naming

Stay concise. Use the function doc comment to describe what the function does,
not the name. Keep in mind functions are in the context of the parent module
and/or object and repeating that would be redundant.

## Dependencies

Before adding any code dependencies, check with the maintainers if this is
okay. In general, we try not to add external dependencies unless it's
necessary. Dependencies increase counter-party risk, build-time, attack
surface, and make code harder to audit.

We also optimize for binary size, which means we try to keep generated code to
a minimum and adding dependencies is one of the biggest sources of code bloat.

## Documentation

For contributors, project guidelines and processes must be documented publicly.

For users, features must be abundantly documented. Documentation should include
answers to common questions, solutions to common problems, and recommendations
for critical decisions that the user may face.

All changes to the core codebase (excluding tests, auxiliary scripts, etc.)
must be documented in a changelog, except for purely cosmetic or documentation
changes.

All Rust items must be documented with documentation comments so that LSPs
display information about said items.

## Automation

Automation should be used as much as possible to reduce the possibility of
human error and forgetfulness.

Automations that make use of sensitive credentials must use secure secret
management, and must be strengthened against attacks such as
[those on GitHub Actions worklows].

Some other examples of automation are:

- Looking for common security vulnerabilities or errors in our code (eg.
  reentrancy analysis).
- Keeping dependencies up to date and monitoring for vulnerable dependencies.

[those on GitHub Actions worklows]: https://github.com/nikitastupin/pwnhub

### Linting & formatting

Always check your code with the linter (`clippy`), by running:

    $ cargo clippy --tests --all-features

And make sure your code is formatted with, using:

    $ cargo +nightly fmt

Finally, ensure there is no trailing whitespace anywhere.

### Running tests

Make sure all tests are passing with:

    $ cargo test --all-features

### Running end-to-end tests

In order to run end-to-end (e2e) tests you need to have a specific nightly toolchain.
"Nightly" is necessary to use optimization compiler flags and have contract wasm small enough to be eligible for
deployment.

Run the following commands to install the necessary toolchain:

```shell
rustup install nightly-2024-01-01
rustup component add rust-src
```

Also, you should have the cargo stylus tool:

```shell
cargo install cargo-stylus
```

Since most of the e2e tests use [koba](https://github.com/OpenZeppelin/koba) for deploying contracts, you need to
[install](https://docs.soliditylang.org/en/latest/installing-solidity.html#) the solidity compiler (`v0.8.24`).

To run e2e tests, you need to have a local nitro test node up and running.
Run the following command and wait till script exit successfully:

```shell
./scripts/nitro-testnode.sh -i -d
```

Then you will be able to run e2e tests:

```shell
./scripts/e2e-tests.sh
```

### Checking the docs

If you make documentation changes, you may want to check whether there are any
warnings or errors:

    $ cargo doc --all-features

## Pull requests

Pull requests are squash-merged to keep the `main` branch history clean. The
title of the pull request becomes the commit message, which should follow
[Semantic versioning].

Work in progress pull requests should be submitted as Drafts and should not be
prefixed with "WIP:".

Branch names don't matter, and commit messages within a pull request mostly
don't matter either, although they can help the review process.

## Writing commit messages

A properly formed git commit subject line should always be able to complete the
following sentence:

     If applied, this commit will _____

In addition, it should be not capitalized and _must not_ include a period. We
prefix all commits by following [Conventional Commits] guidelines. For example,
the following message is well formed:

    feat(merkle): add single-leaf proof verification

While these ones are **not**: `add single-leaf proof verification`,
`Added single-leaf proof verification`, `Add single-leaf proof verification`,
`frob: add single-leaf proof verification`, `feat: Add single-leaf proof
verification`.

When it comes to formatting, here's a model git commit message[1]:

     type: lower-case, short (50 chars or less) summary

     More detailed explanatory text, if necessary.  Wrap it to about 72
     characters or so.  In some contexts, the first line is treated as the
     subject of an email and the rest of the text as the body.  The blank
     line separating the summary from the body is critical (unless you omit
     the body entirely); tools like rebase can get confused if you run the
     two together.

     Write your commit message in the imperative: "Fix bug" and not "Fixed bug"
     or "Fixes bug."  This convention matches up with commit messages generated
     by commands like git merge and git revert.

     Further paragraphs come after blank lines.

     - Bullet points are okay, too.
     - Typically a hyphen or asterisk is used for the bullet, followed by a
       single space, with blank lines in between, but conventions vary here.
     - Use a hanging indent.

## Rust Conventions

In addition to the official [The Rust Style Guide] we have a number of other
conventions that must be followed.

- All arithmetic should be checked, matching Solidity's behavior, unless
  overflow/underflow is guaranteed not to happen. Unchecked arithmetic blocks
  should contain comments explaining why overflow is guaranteed not to happen.
  If the reason is immediately apparent from the line above the unchecked
  block, the comment may be omitted.
- Custom errors should be declared following the [EIP-6093] rationale whenever
  reasonable. Also, consider the following:

    - The domain prefix should be picked in the following order:
        1. Use `ERC<number>` if the error is a violation of an ERC specification.
        2. Use the name of the underlying component where it belongs (eg.
           `Governor`, `ECDSA`, or `Timelock`).

[The Rust Style Guide]: https://doc.rust-lang.org/nightly/style-guide/

[EIP-6093]: https://eips.ethereum.org/EIPS/eip-6093

[Semantic versioning]: https://semver.org/spec/v2.0.0.html

[Conventional Commits]: https://www.conventionalcommits.org/en/v1.0.0/
