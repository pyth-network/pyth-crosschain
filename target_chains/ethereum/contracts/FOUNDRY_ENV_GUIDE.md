# Foundry Environment Variables Guide

This guide shows the **recommended Foundry-native approaches** for reading environment variables in deployment scripts, without custom parsers.

## 🎯 Recommended Approaches

### 1. **Comma-Separated Arrays** ⭐ **BEST FOR MOST CASES**

**Use Case:** Arrays of addresses, numbers, or simple types

**Environment Format:**
```bash
# Multiple addresses
INIT_SIGNERS=0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5,0x025ceeba2ab2a27d53d963393999eeebe83dc4ae

# Multiple numbers
CHAIN_IDS=1,137,56,43114

# Multiple strings (if supported)
NETWORKS=ethereum,polygon,bsc
```

**Solidity Code:**
```solidity
// Read address array
address[] memory signers = vm.envAddress("INIT_SIGNERS", ",");

// Read uint array  
uint256[] memory chainIds = vm.envUint("CHAIN_IDS", ",");

// Convert addresses to bytes32 if needed
bytes32[] memory guardians = new bytes32[](signers.length);
for (uint i = 0; i < signers.length; i++) {
    guardians[i] = bytes32(uint256(uint160(signers[i])));
}
```

**✅ Advantages:**
- Native Foundry support
- Clean, readable format
- No parsing needed
- Works with all basic types

### 2. **JSON with vm.parseJson** (For Complex Data)

**Use Case:** Complex nested data structures

**Environment Format:**
```bash
# Simple array
INIT_SIGNERS='["0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5","0x025ceeba2ab2a27d53d963393999eeebe83dc4ae"]'

# Complex object
CONFIG='{"guardians":["0x..."],"chainId":1,"enabled":true}'
```

**Solidity Code:**
```solidity
// Simple array
string memory signersJson = vm.envString("INIT_SIGNERS");
address[] memory signers = abi.decode(vm.parseJson(signersJson), (address[]));

// Complex object with key selection
string memory configJson = vm.envString("CONFIG");
address[] memory guardians = abi.decode(vm.parseJson(configJson, ".guardians"), (address[]));
uint256 chainId = abi.decode(vm.parseJson(configJson, ".chainId"), (uint256));
bool enabled = abi.decode(vm.parseJson(configJson, ".enabled"), (bool));
```

**⚠️ Requirements:**
- JSON must be properly formatted
- Use single quotes in .env files to prevent shell parsing issues
- May need escaping for complex nested structures

### 3. **Individual Environment Variables** (Simple & Reliable)

**Use Case:** When you have a known, small number of values

**Environment Format:**
```bash
GUARDIAN_1=0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5
GUARDIAN_2=0x025ceeba2ab2a27d53d963393999eeebe83dc4ae
GUARDIAN_COUNT=2
```

**Solidity Code:**
```solidity
uint256 guardianCount = vm.envUint("GUARDIAN_COUNT");
bytes32[] memory guardians = new bytes32[](guardianCount);

for (uint i = 0; i < guardianCount; i++) {
    string memory key = string(abi.encodePacked("GUARDIAN_", vm.toString(i + 1)));
    address guardian = vm.envAddress(key);
    guardians[i] = bytes32(uint256(uint160(guardian)));
}
```

**✅ Advantages:**
- Most reliable
- Easy to debug
- No parsing issues
- Clear variable names

## 📋 Available Foundry VM Methods

```solidity
// Basic types
vm.envString("KEY")          // string
vm.envAddress("KEY")         // address  
vm.envUint("KEY")            // uint256
vm.envInt("KEY")             // int256
vm.envBytes32("KEY")         // bytes32
vm.envBytes("KEY")           // bytes
vm.envBool("KEY")            // bool

// Arrays with delimiter
vm.envAddress("KEY", ",")    // address[]
vm.envUint("KEY", ",")       // uint256[]
vm.envInt("KEY", ",")        // int256[]
vm.envBytes32("KEY", ",")    // bytes32[]
vm.envString("KEY", ",")     // string[]

// With default values
vm.envOr("KEY", defaultValue)

// JSON parsing
vm.parseJson(jsonString)           // Parse entire JSON
vm.parseJson(jsonString, ".key")   // Parse specific key
```

## 🛠️ Our Implementation

**Current Deploy.s.sol uses Approach #1 (Comma-Separated):**

```solidity
// ✅ Clean, native Foundry approach
address[] memory signerAddresses = vm.envAddress("INIT_SIGNERS", ",");

// Convert to bytes32 for Wormhole
bytes32[] memory initialSigners = new bytes32[](signerAddresses.length);
for (uint i = 0; i < signerAddresses.length; i++) {
    initialSigners[i] = bytes32(uint256(uint160(signerAddresses[i])));
}
```

**Environment Format:**
```bash
INIT_SIGNERS=0x58CC3AE5C097b213cE3c81979e1B9f9570746AA5,0x025ceeba2ab2a27d53d963393999eeebe83dc4ae
```

## 🚫 What to Avoid

- ❌ Custom string parsing functions
- ❌ Complex regex operations
- ❌ Manual hex conversion (use vm.envAddress instead)
- ❌ Hardcoded values in scripts
- ❌ Unescaped JSON in environment files

## 💡 Best Practices

1. **Use comma-separated for simple arrays**
2. **Use individual vars for small, known sets**
3. **Use JSON only for complex nested data**
4. **Always validate environment variables exist**
5. **Use `vm.envOr()` for optional values with defaults**
6. **Keep environment files well-documented**
7. **Test with different environment configurations**

## 🧪 Testing

```bash
# Test with current environment
forge script script/Deploy.s.sol

# Test with specific environment file
cp .env.test .env && forge script script/Deploy.s.sol

# Test individual components
forge script script/Deploy.s.sol --sig "deployWormhole()"
```
