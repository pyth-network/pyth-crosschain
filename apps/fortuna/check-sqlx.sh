#!/bin/bash
cd apps/fortuna || exit 1
cargo sqlx prepare --check
