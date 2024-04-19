#/bin/bash

set -euo pipefail

# Root of the repository
REPO_ROOT=$(git rev-parse --show-toplevel)


echo "Building the image for the receiver program"
docker build --platform linux/x86_64 -t solana-receiver-builder -f $REPO_ROOT/target_chains/solana/Dockerfile $REPO_ROOT

echo "Building the receiver program"
docker run --platform linux/x86_64 --rm -v $REPO_ROOT/target_chains/solana/artifacts:/artifacts solana-receiver-builder

echo "Successfully built the receiver program."
echo "The artifacts are available at $REPO_ROOT/target_chains/solana/artifacts"

CHECKSUM=$(sha256sum $REPO_ROOT/target_chains/solana/artifacts/pyth_solana_receiver.so | awk '{print $1}')
echo "sha256sum of the pyth_solana_receiver program: $CHECKSUM"
CHECKSUM=$(sha256sum $REPO_ROOT/target_chains/solana/artifacts/pyth_push_oracle.so | awk '{print $1}')
echo "sha256sum of the pyth_push_oracle program: $CHECKSUM"
