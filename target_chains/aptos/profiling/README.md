# Gas Profiling Utilities

You can compile and run a simple script in this package to profile gas consumption on a deployed pyth contract.
Here are the steps:

1. Run `aptos move compile` to compile the script
2. Run the following to simulate the transaction and create a gas profile:
   ```
   aptos move run-script --compiled-script-path build/Profiler/bytecode_scripts/main.mv --args hex:<update_data_payload_in_hex> --profile-gas
   ```
3. Open the created svg files in the `gas-profiling` folder to inspect gas consumption by each module and function
