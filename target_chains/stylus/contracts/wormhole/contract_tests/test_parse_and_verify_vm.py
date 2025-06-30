#!/usr/bin/env python3
"""
Python script to test parse_and_verify_vm function on deployed Stylus Wormhole contract
Requires: pip install web3 base64
"""

import base64
from web3 import Web3
import json

CONTRACT_ADDRESS = "0x3f38404a2e3cb949bcdfa19a5c3bdf3fe375feb0"
RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc"

VAA_BASE64 = "AQABBBQNABKrA7vVGbeFAN4q6OpjL0zVVs8aPJHPqnj6KuboY755N5i2on/i4nXb2nahbVGDDqj9WV2DgLRdUyqoXL/C6HsBA6l03OVpWBMU5Kjh4a3yn539u/m6ieboUz5D2wAqrt0UHCPgOuXlixoEnYZJ2kTGOT0yqd/grj9g1i9hWkGsi/0BBei0DUXj9iLQ8PQfJGQRWluvvBefZrCi7sIpaN1P10FbABdrFE/Mop+h1n4vHleYqtX1DyD/Hl2CUVPRm+TL6AsABigepLVMC/ybUdI71rW5yKda/DxJ/ZtRa1c7iUOxUnpfENoxwLheaJLMfDVb0bfybkPnbq/UjQ3OjP9LMbb2Y5wBBy1uE/9Pv1nIswbb0H4Q4ej1X7W2vvdWTrt3AmrDPOvYfg3mK+Wae5ifPhCFKas7y2gUfHLm0I7INKTHQ+jjK3oBCjc+jJahqTQu/xPi+kgxvsSwwswoxPEgrd3UsylDbGRMKeEQ8pbB8dP3PzkKThYvVjQ56Vl1+ZZkVf4EzKi7uxIAC03+AG9MIrRsCZenLd8/BwJbr3M1MlIRDAE/JZQctOneEhL0ta0KifLZ8516sfpOLO0j4hyX2JGB7+KhEwaa7rAADOgUbAVn/Od0Mcz5T4Xdu0VJVXbvDcP4WC1vuiKYUuwvHI2lPRwUGEXBinmYuFAzBv5goEO+et71DBPbSocfyAgADUmsnFBn9Sqt1X6QUF3KD8aYb0O7x/w33W/VS+3Bl3JnEjfD8RbDWBmfKhamm6B55g3WytoDz5E+0UfwjMBhEs8BDqxaRg10LY8c2ASx/Ps8UZ8qFYdcQ0liJdfiXxaDMZzwMuQpYr3S+CzartkfaNfRKl4269UtQTxbCHYrnu4XrIMBDzNfMrUQCBQPyYTDsAubNi2AbmAsgrcGHNCquna7ScXaFrYbDrWcxNbXRL20fQ8m7lH1llM3S4UC25smNOino8sBEHDm77bSISVBykPRwfkZdtezi7RGxtFfb0jh1Iu54/pXKyQFjKKOzush9dXGvwCVCeKHL7P+PRT8e+FCxFMFaZEAEVxXoDeizuUQoHG1G+o0MNqT/JS4SfE7SyqZ6VJoezHZIxUFlvqYRufJsGk6FU6OO1zbxdL8evNXIoU0TFHVLwoBaEiioAAAAAAAFYm5HmjQJklWYyvxH4q9IkPKpWxKQsl9m5fq3HG/EHS/AAAAAAAAeRsA3ca06nFfN50X8Ov9vOf/MclvDB12K3Pdhb7X87OIwKs="

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
        print("getting guardians")
        guardian_set = contract.functions.getGuardianSet(4).call()
        print("got guardians")
        if len(guardian_set) > 0:
            print(f"✅ Contract initialized: Guardian set 4 has {len(guardian_set)} bytes")
        else:
            print("❌ Contract not initialized - guardian set 4 is empty")
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
