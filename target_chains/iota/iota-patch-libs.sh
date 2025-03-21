#!/bin/bash

set -euo pipefail

# This script patches the SUI code to be compatible with IOTA.  IOTA is a fork
# of SUI but is not compatible with SUI.  You'd need to run this script for
# deploying Pyth contracts and updating the vendored libs.
#
# Note: Do not commit the patched Pyth code to the repo.

# Check if exactly one argument (base path) is provided
if [ $# -ne 1 ]; then
    echo "Usage: $0 <base-path>"
    exit 1
fi

# Detect OS to determine correct sed syntax
if sed --version >/dev/null 2>&1; then
    SED_CMD=sed
else
    if ! command -v gsed >/dev/null 2>&1; then
        echo "Error: GNU sed (gsed) is required for macOS/BSD. Install core-utils via Homebrew."
        exit 1
    fi
    SED_CMD=gsed
fi

# Use find to get all .move files recursively and process them
find "$1" -type f -name "*.move" | while read -r file; do
    echo "Processing: $file"
    $SED_CMD -i -e 's/\bSUI\b/IOTA/g' \
           -e 's/\bSui\b/Iota/g' \
           -e 's/\bsui\b/iota/g' "$file"
done

echo "Replacements complete."
