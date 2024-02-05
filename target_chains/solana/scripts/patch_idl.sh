#! /bin/bash
cat target/idl/pyth_solana_receiver.json |
# ADD EXTERNAL TYPES
jq --slurpfile external_types target/idl/external_types.json '.types += $external_types[]' > target/idl/tmp.json && mv target/idl/tmp.json target/idl/pyth_solana_receiver.json
