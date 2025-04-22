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
python3 -c "
import re

def replace_mod_protobuf(file_path):
    with open(file_path, 'r') as f:
        content = f.read()

    pattern = re.compile(r'mod\s+protobuf\s*\{.*?\}', re.DOTALL)

    replacement = 'mod protobuf;'

    new_content = pattern.sub(replacement, content)

    with open(file_path, 'w') as f:
        f.write(new_content)

replace_mod_protobuf('${PACKAGE_DIR}/src/lib.rs')
"

echo "publishing package"
cargo publish --token ${CARGO_REGISTRY_TOKEN} --allow-dirty
