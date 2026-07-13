#!/bin/bash

set -euo pipefail

iota move test -p .
iota move test -p ./vendor/wormhole
