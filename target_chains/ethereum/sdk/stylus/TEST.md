### Running Unit Tests for `pyth-stylus`

To run all the unit tests for the `pyth-stylus` package with all its features enabled, use the following command:

```bash
cargo test -p pyth-stylus --all-features
```

This command will:
- Target the `pyth-stylus` package specifically (`-p pyth-stylus`).
- Enable **all features** defined in the package during the test run (`--all-features`).


### Running End-to-End Tests

To run the end-to-end tests for `pyth-stylus`, follow these steps:

1. Start the test node:

   ```bash
   ./scripts/nitro-testnode.sh
   ```

2. Run the end-to-end tests:

   ```bash
   ./scripts/e2e-tests.sh
   ```

These commands will set up the test environment and run the full end-to-end tests.

