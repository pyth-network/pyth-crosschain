#!/bin/bash

set -euo pipefail

iota move build -p .

for f in vendor/* .; do
    echo "$f:"
    iota move test -p "$f"
done
