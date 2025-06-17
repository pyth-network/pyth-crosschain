#!/bin/bash

set -e

CONTRACT_ADDRESS="0x3f38404a2e3cb949bcdfa19a5c3bdf3fe375feb0"
RPC_URL="https://sepolia-rollup.arbitrum.io/rpc"

CHAIN_ID=60051
GOVERNANCE_CHAIN_ID=1
GOVERNANCE_CONTRACT="0x0000000000000000000000000000000000000004"

GUARDIAN_ADDRESSES="[0x5893B5A76c3f739645648885bDCcC06cd70a3Cd3,0xfF6CB952589BDE862c25Ef4392132fb9D4A42157,0x114De8460193bdf3A2fCf81f86a09765F4762fD1,0x107A0086b32d7A0977926A205131d8731D39cbEB,0x8C82B2fd82FaeD2711d59AF0F2499D16e726f6b2,0x11b39756C042441BE6D8650b69b54EbE715E2343,0x54Ce5B4D348fb74B958e8966e2ec3dBd4958a7cd,0x15e7cAF07C4e3DC8e7C469f92C8Cd88FB8005a20,0x74a3bf913953D695260D88BC1aA25A4eeE363ef0,0x000aC0076727b35FBea2dAc28fEE5cCB0fEA768e,0xAF45Ced136b9D9e24903464AE889F5C8a723FC14,0xf93124b7c738843CBB89E864c862c38cddCccF95,0xD2CC37A4dc036a8D232b48f62cDD4731412f4890,0xDA798F6896A3331F64b48c12D1D57Fd9cbe70811,0x71AA1BE1D36CaFE3867910F99C09e347899C19C3,0x8192b6E7387CCd768277c17DAb1b7a5027c0b3Cf,0x178e21ad2E77AE06711549CFBB1f9c7a9d8096e8,0x5E1487F35515d02A92753504a8D75471b9f49EdB,0x6FbEBc898F403E4773E95feB15E80C9A99c8348d]"

echo "🔍 Initializing Stylus Wormhole contract"
echo "Contract: $CONTRACT_ADDRESS"
echo "Network: Arbitrum Sepolia"
echo ""

echo "📋 Initialization Parameters:"
echo "  Chain ID: $CHAIN_ID"
echo "  Governance Chain ID: $GOVERNANCE_CHAIN_ID"
echo "  Governance Contract: $GOVERNANCE_CONTRACT"
echo "  Guardian Addresses: 19 mainnet guardian set 4 addresses"
echo ""

echo "🚀 Calling initialize function..."
echo "Command: cast send $CONTRACT_ADDRESS \"initialize(address[],uint16,uint16,address)\" \"$GUARDIAN_ADDRESSES\" $CHAIN_ID $GOVERNANCE_CHAIN_ID $GOVERNANCE_CONTRACT --rpc-url $RPC_URL --private-key \$PRIVATE_KEY"

if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY environment variable not set"
    echo "Please set your private key: export PRIVATE_KEY=\"your-private-key-here\""
    exit 1
fi

if cast send "$CONTRACT_ADDRESS" "initialize(address[],uint16,uint16,address)" "$GUARDIAN_ADDRESSES" $CHAIN_ID $GOVERNANCE_CHAIN_ID $GOVERNANCE_CONTRACT --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY"; then
    echo "✅ Contract initialization successful!"
    echo ""
    
    echo "🔍 Verifying initialization..."
    echo "Testing quorum function (pure function)..."
    if cast call "$CONTRACT_ADDRESS" "quorum(uint32)" 3 --rpc-url "$RPC_URL"; then
        echo "✅ Pure function works"
    else
        echo "❌ Pure function failed"
    fi
    
    echo "Testing getGuardianSet function..."
    if cast call "$CONTRACT_ADDRESS" "getGuardianSet(uint32)" 4 --rpc-url "$RPC_URL"; then
        echo "✅ Guardian set retrieval works - contract is initialized"
    else
        echo "❌ Guardian set retrieval failed"
    fi
    
    echo ""
    echo "🎯 Next steps:"
    echo "1. Run your test scripts to verify parse_and_verify_vm works"
    echo "2. Test with different VAA data for comprehensive validation"
    echo "3. Monitor contract functionality for production readiness"
    
else
    echo "❌ Contract initialization failed!"
    echo ""
    echo "🔧 Debugging hints:"
    echo "- Check if contract is already initialized"
    echo "- Verify guardian address format is correct"
    echo "- Ensure you have sufficient gas and ETH for the transaction"
    echo "- Check if the private key has permission to call initialize"
fi
