#!/bin/bash
set -e

# Generate the lcov.info file
forge coverage --report lcov

# Filter out unnecessary stuff from the coverage report
lcov \
    --rc branch_coverage=1 \
    --remove lcov.info \
    --output-file filtered-lcov.info \
    "*node_modules*" "*mock*" "contracts/libraries/external/*.sol" \

# Generate the filtered summary
lcov \
    --rc branch_coverage=1 \
    --list filtered-lcov.info

# Generate the html coverage file
genhtml \
    --rc branch_coverage=1 \
    --output-directory coverage \
    --ignore-errors category \
    --ignore-errors category,category \
    filtered-lcov.info

echo "Test coverage results successfully generated in the 'coverage' directory"
