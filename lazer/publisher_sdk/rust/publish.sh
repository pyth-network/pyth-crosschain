#!/bin/bash
set -e

PACKAGE_DIR="."

echo "building package to generate type files"
OUT_DIR=$(cargo build --message-format=json | jq -r 'select(.reason == "build-script-executed") | .out_dir' | grep "pyth-lazer-publisher-sdk")

echo "using output directory: ${OUT_DIR}"

echo "copying files from protobuf output to package directory"
cp -r "${OUT_DIR}/protobuf" "${PACKAGE_DIR}/src/"

echo "deleting build.rs file"
rm -f "${PACKAGE_DIR}/build.rs"

echo "updating lib.rs to export local protobuf files"
cat > "${PACKAGE_DIR}/src/lib.rs" << EOF
pub mod transaction {
    pub use crate::protobuf::pyth_lazer_transaction::*;
}
pub mod publisher_update {
    pub use crate::protobuf::publisher_update::*;
}
mod protobuf;
EOF

echo "removing build spec from Cargo.toml"
# MacOS sed command is slightly different
# This script shouldn't be run locally anyway, but I may as well make sure it works
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' '/build.*build\.rs/d' Cargo.toml
else
  sed -i '/build.*build\.rs/d' Cargo.toml
fi
