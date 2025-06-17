#!/usr/bin/env python3
"""
Python script to test parse_and_verify_vm function on deployed Stylus Wormhole contract
Requires: pip install web3 base64
"""

import base64
from web3 import Web3
import json

CONTRACT_ADDRESS = "0x7c56d119a916da6593e1fd8c1d010161f20afd70"
RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc"

VAA_BASE64 = "AQABBppppppLun8KH+IfCb2c9rlKrXV8wDcZUeMtLeoxoJLHAu7kH40xE1IY5uaJLT4PRsWDDv+7GHNT8rDP+4hUaJNHMtkBAvbQ7aUofV+VAoXjfqrU+V4Vzgvkpwuowaj0BMzNTSp2PkKz5BsnfvC7cxVwOw9sJnQfPvN8KrmhA0IXgQdkQDIBA/0sVNcwZm1oic2G6r7c3x5DyEO9sRF2sTDyM4nuiOtaWPbgolaK6iU3yTx2bEzjdKsdVD2z3qs/QReV8ZxtA5MBBKSm2RKacsgdvwwNZPB3Ifw3P2niCAhZA435PkYeZpDBd8GQ4hALy+42lffR+AXJu19pNs+thWSxq7GRxF5oKz8BBYYS1n9/PJOybDhuWS+PI6YU0CFVTC9pTFSFTlMcEpjsUbT+cUKYCcFU63YaeVGUEPmhFYKeUeRhhQ5g2cCPIegABqts6uHMo5hrdXujJHVEqngLCSaQpB2W9I32LcIvKBfxLcx9IZTjxJ36tyNo7VJ6Fu1FbXnLW0lzaSIbmVmlGukABzpn+9z3bHT6g16HeroSW/YWNlZD5Jo6Zuw9/LT4VD0ET3DgFZtzytkWlJJKAuEB26wRHZbzLAKXfRl+j8kylWQACTTiIiCjZxmEUWjWzWe3JvvPKMNRvYkGkdGaQ7bWVvdiZvxoDq1XHB2H7WnqaAU6xY2pLyf6JG+lV+XZ/GEY+7YBDD/NU/C/gNZP9RP+UujaeJFWt2dau+/g2vtnX/gs2sgBf+yMYm6/dFaT0TiJAcG42zqOi24DLpsdVefaUV1G7CABDjmSRpA//pdAOL5ZxEFG1ia7TnwslsgsvVOa4pKUp5HSZv1JEUO6xMDkTOrBBt5vv9n6zYp3tpYHgUB/fZDh/qUBDzHxNtrQuL/n8a2HOY34yqljpBOCigAbHj+xQmu85u8ieUyge/2zqTn8PYMcka3pW1WTzOAOZf1pLHO+oPEfkTMBEGUS9UOAeY6IUabiEtAQ6qnR47WgPPHYSZUtKBkU0JscDgW0cFq47qmet9OCo79183dRDYE0kFIhnJDk/r7Cq4ABEfBBD83OEF2LJKKkJIBL/KBiD/Mjh3jwKXqqj28EJt1lKCYiGlPhqOCqRArydP94c37MSdrrPlkh0bhcFYs3deMAaEhJXwAAAAAABQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAAAAAAAEDRXIAQAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMMN2oOke3QAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABu3yoHkAEAAAAAAAAAAAAAAAAPpLFVLLUvQgzfCF8uDxxgOpZXNaAAAAAAAAAAAAAAAAegpThHd29+lMw1dClxrLIhew24EAAAAAAAAAAAAAAAB6ClOEd3b36UzDV0KXGssiF7DbgQAAAAAAAAAAAAAAACdCjdLT3TKk1/fEl+qqIxMNiUkRAA=="

CONTRACT_ABI = [
    {
        "type": "function",
        "name": "initialize",
        "inputs": [
            {"name": "initial_guardians", "type": "address[]"},
            {"name": "chain_id", "type": "uint16"},
            {"name": "governance_chain_id", "type": "uint16"},
            {"name": "governance_contract", "type": "address"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "getGuardianSet",
        "inputs": [{"name": "index", "type": "uint32"}],
        "outputs": [{"name": "", "type": "uint8[]"}],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "parseAndVerifyVm",
        "inputs": [{"name": "encoded_vaa", "type": "uint8[]"}],
        "outputs": [{"name": "", "type": "uint8[]"}],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "quorum",
        "inputs": [{"name": "num_guardians", "type": "uint32"}],
        "outputs": [{"name": "", "type": "uint32"}],
        "stateMutability": "pure"
    }
]

def test_parse_and_verify_vm():
    """Test the parse_and_verify_vm function on the deployed contract"""
    
    print("🔍 Testing parse_and_verify_vm function on deployed Stylus Wormhole contract")
    print(f"Contract: {CONTRACT_ADDRESS}")
    print(f"Network: Arbitrum Sepolia")
    print()
    
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    
    if not w3.is_connected():
        print("❌ Failed to connect to RPC endpoint")
        return False
        
    print("✅ Connected to Arbitrum Sepolia")
    
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(CONTRACT_ADDRESS),
        abi=CONTRACT_ABI
    )
    
    print("📝 Converting VAA from base64 to bytes...")
    vaa_bytes = base64.b64decode(VAA_BASE64)
    print(f"VAA byte length: {len(vaa_bytes)}")
    print()
    
    print("🔍 Test 1: Checking contract initialization")
    try:
        guardian_set = contract.functions.getGuardianSet(0).call()
        if len(guardian_set) > 0:
            print(f"✅ Contract initialized: Guardian set 0 has {len(guardian_set)} bytes")
        else:
            print("❌ Contract not initialized - guardian set 0 is empty")
            print("⚠️  parse_and_verify_vm will fail until contract is initialized")
            return False
    except Exception as e:
        print(f"❌ Failed to check initialization: {e}")
        print("⚠️  Contract likely not initialized - run initialization script first")
        return False
    
    print()
    
    print("🔍 Test 2: Testing pure function (quorum)")
    try:
        quorum_result = contract.functions.quorum(3).call()
        print(f"✅ quorum(3) = {quorum_result} (contract deployment is valid)")
    except Exception as e:
        print(f"❌ Failed to call quorum function: {e}")
        print("This suggests a fundamental issue with the contract deployment")
        return False
    
    print()
    
    print("🚀 Test 3: Calling parse_and_verify_vm")
    try:
        vaa_uint8_array = list(vaa_bytes)
        print(f"Converted VAA to uint8 array with {len(vaa_uint8_array)} elements")
        
        result = contract.functions.parseAndVerifyVm(vaa_uint8_array).call()
        print(f"✅ parse_and_verify_vm succeeded!")
        print(f"Guardian set is working properly! ✅")
        print(f"Contract can successfully verify VAAs with the initialized guardian addresses.")
        print(f"Returned payload length: {len(result)} bytes")
        print(f"Payload (hex): {bytes(result).hex()[:100]}..." if len(result) > 50 else f"Payload (hex): {bytes(result).hex()}")
        
        try:
            if len(result) > 0:
                result_bytes = bytes(result)
                text_attempt = result_bytes[32:].decode('utf-8', errors='ignore').strip('\x00')
                if text_attempt:
                    print(f"Payload (text): {text_attempt[:100]}...")
        except:
            pass
            
        return True
        
    except Exception as e:
        print(f"❌ parse_and_verify_vm failed: {e}")
        
        print("\n🔧 Debugging hints:")
        print("- Check if contract is properly initialized with guardian sets")
        print("- Verify the VAA data matches expected guardian signatures")
        print("- Ensure guardian set index in VAA matches contract state")
        print("- Run initialization script: chmod +x /tmp/initialize_contract.sh && /tmp/initialize_contract.sh")
        print("- Set PRIVATE_KEY environment variable before running initialization")
        
        return False

def estimate_gas():
    """Estimate gas usage for the parse_and_verify_vm function"""
    print("\n⛽ Estimating gas usage...")
    
    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    contract = w3.eth.contract(
        address=Web3.to_checksum_address(CONTRACT_ADDRESS),
        abi=CONTRACT_ABI
    )
    
    vaa_bytes = base64.b64decode(VAA_BASE64)
    
    try:
        vaa_uint8_array = list(vaa_bytes)
        gas_estimate = contract.functions.parseAndVerifyVm(vaa_uint8_array).estimate_gas()
        print(f"✅ Estimated gas: {gas_estimate:,}")
        
        gas_prices = [0.1, 0.5, 1.0, 2.0]  # gwei
        print("\n💰 Estimated costs:")
        for price in gas_prices:
            cost_eth = (gas_estimate * price * 1e9) / 1e18
            print(f"  At {price} gwei: {cost_eth:.6f} ETH")
            
    except Exception as e:
        print(f"❌ Gas estimation failed: {e}")

if __name__ == "__main__":
    success = test_parse_and_verify_vm()
    
    if success:
        estimate_gas()
        print("succ: ", success)
        print("\n🎯 Test Summary: ✅ ALL TESTS PASSED")
        print("Your parse_and_verify_vm function is working correctly on-chain!")
    else:
        print("\n🎯 Test Summary: ❌ TESTS FAILED")
        print("Check contract initialization and guardian set configuration.")
    
    print("\n💡 Next steps:")
    print("1. Test with different VAA data for comprehensive validation")
    print("2. Test error cases (invalid VAAs, corrupted signatures)")
    print("3. Monitor gas costs for production usage planning")
    print("4. Set up automated monitoring for contract health")
    print("\n🔧 If tests failed:")
    print("1. Run diagnostic script: python3 /tmp/test_contract_state.py")
    print("2. Initialize contract: export PRIVATE_KEY=\"your-key\" && chmod +x /tmp/initialize_contract.sh && /tmp/initialize_contract.sh")
    print("3. Retry this test script")
