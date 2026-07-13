#!/bin/sh

RUST_LOG="off,iota_node=info" iota-localnet start --force-regenesis --with-faucet
