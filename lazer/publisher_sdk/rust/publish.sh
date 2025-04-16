#!/bin/bash
set -e

echo "building package to generate type files"
OUT_DIR=$(cargo build --message-format=json | jq -r 'select(.reason == "build-script-executed") | .out_dir' | grep "pyth-lazer-publisher-sdk")

echo "using output directory: ${OUT_DIR}"

echo "copying files from protobuf output to package directory"
cp -r "${OUT_DIR}/protobuf" "./src/"

echo "deleting build.rs file"
rm -f "./build.rs"

# echo "updating lib.rs to point to correct artifacts"
cat > "./src/lib.rs" << EOF
pub mod protobuf;
EOF
