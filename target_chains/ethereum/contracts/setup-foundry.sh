#!/bin/bash
# Complete Forge setup script - installs Foundry and dependencies
set -e

FOUNDRY_VERSION="v0.3.0"

echo "Setting up complete Forge environment with Foundry ${FOUNDRY_VERSION}..."

# Check if foundryup is available
if ! command -v foundryup &> /dev/null; then
    echo "Installing foundryup..."
    curl -L https://foundry.paradigm.xyz | bash
    export PATH="$HOME/.foundry/bin:$PATH"
fi

# Install the specific version
echo "Installing Foundry ${FOUNDRY_VERSION}..."
foundryup --version $FOUNDRY_VERSION

# Verify installation
echo "Verifying installation..."
forge --version
cast --version
anvil --version

echo "Foundry ${FOUNDRY_VERSION} installed successfully!"

echo "Setup complete! You can now run install-forge-deps."
