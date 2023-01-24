#!/usr/bin/env bash

docker run --rm -v "$(pwd)":/code \
  -v $(cd ../../third_party; pwd):/third_party \
  --mount type=volume,source="$(basename "$(pwd)")_cache",target=/code/target \
  --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
  cosmwasm/workspace-optimizer:0.12.11
