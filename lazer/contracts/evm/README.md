## Pyth Lazer EVM Contract and SDK

This package is built using [Foundry](https://book.getfoundry.sh/).

`PythLazer` is an EVM on-chain contract that keeps track of trusted signers of Pyth Lazer payloads. It allows consumers to easily check validity of Pyth Lazer signatures while enabling key rotation.

`PythLazerReceiver` contains utilities required to validate and parse Pyth Lazer payloads. Contracts should use `PythLazerReceiver` as the base contract (or one of the base contracts) of their contracts to gain access to the provided functions.

### Packed EVM payloads

`PythLazerPackedEvmLib` reads `packedEvmEcdsa` payloads. A packed payload carries up to 255 feeds. Each group of four feeds shares one 32-byte word: four 6-byte lanes (price, exponent, confidence code, spread code) and the payload timestamp. A consumer can store a whole word in one storage slot. `Codebook256` decodes the confidence and spread codes into 0.01 bps.

Every function is `internal`, so it compiles into your contract and needs no linked library. The payload readers take `bytes calldata`. `verifyUpdate` is an external call and returns its payload as `bytes memory`, so `getPayloadFromUpdate` slices the same payload out of your own calldata instead. Call it only after `verifyUpdate` has succeeded.

```solidity
import {PythLazer} from "pyth-lazer/PythLazer.sol";
import {PythLazerPackedEvmLib} from "pyth-lazer/PythLazerPackedEvmLib.sol";

contract PriceStore {
    PythLazer public immutable pythLazer;
    mapping(uint32 => bytes32) public wordOf; // feed id => the word holding it
    mapping(uint32 => uint256) public slotOf; // feed id => its lane in that word

    constructor(PythLazer _pythLazer) {
        pythLazer = _pythLazer;
    }

    function updatePrice(bytes calldata update, uint32 feedId) external payable {
        // 1. Verify the signature.
        pythLazer.verifyUpdate{value: pythLazer.verification_fee()}(update);
        bytes calldata payload = PythLazerPackedEvmLib.getPayloadFromUpdate(update);

        // 2. Decode. `findFeed` checks the `PEVM` magic.
        (bool found, uint256 index) = PythLazerPackedEvmLib.findFeed(payload, feedId);
        require(found, "feed not in payload");

        // 3. Store the word: four feeds and the timestamp in one slot.
        wordOf[feedId] = PythLazerPackedEvmLib.getBlockWord(payload, index / 4);
        slotOf[feedId] = index % 4;
    }

    function price(uint32 feedId) external view returns (uint32 mantissa, int16 exponent, uint64 timestampUs) {
        bytes32 word = wordOf[feedId];
        uint48 lane = PythLazerPackedEvmLib.getWordLane(word, slotOf[feedId]);
        // Reverts with `PriceUnavailable` when the feed had no fresh price.
        (mantissa, exponent) = PythLazerPackedEvmLib.getPrice(lane);
        timestampUs = PythLazerPackedEvmLib.getWordTimestamp(word);
    }
}
```

When you know the order you subscribed in, skip `findFeed` and call `parseHeader` once, to check the magic, and then `getBlockWord` or `getLane` by index. Feed `i` is lane `i % 4` of block `i / 4`.

The price, the confidence and the spread of a lane are independent. Check each with `hasPrice`, `hasConfidence` and `hasSpread`, or let the matching getter revert. A real price stays readable when both codes are unavailable.

The decoder checks only the magic and the payload length. It does not check the reserved byte, the zero padding in the last block, or that every block has the same timestamp. The payload is signed by Pyth, so those checks would only cost gas. Slots past `numFeeds` hold a zero lane, which reads as a price of 0, so do not read them.

### Build

```shell
forge build
```

### Test

```shell
forge test
```

### Format

```shell
forge fmt
```

### Gas Snapshots

```shell
forge snapshot
```

### Anvil

Anvil does not come with CreateX by default. It can be deployed or an RPC which has the contract can be forked. The below command forks an RPC with a functional CreateX contract.

```shell
anvil --fork-url "https://sepolia.drpc.org"
```

### Deploy

Run the following commands to deploy the `PythLazer` contract to the target network. For the verification to work, you need to provide an API key (which is
etherscan most of the times). If you can't make it work, you can always deploy the contract without verification and verify it manually later (using the
standard input json format).

```shell
export ETHERSCAN_API_KEY=<your_etherscan_api_key>
forge script script/PythLazerDeploy.s.sol --rpc-url <your_rpc_url> --private-key <your_private_key> --broadcast --verify
```

Then, run the following command to add the trusted signer to the `PythLazer` contract. The trusted signer is the address of the Pyth Lazer payload signer, and
the expiration timestamp is the time when the signer will no longer be trusted.

```shell
cast send --rpc-url <your_rpc_url> --private-key <your_private_key> 0xACeA761c27A909d4D3895128EBe6370FDE2dF481 "updateTrustedSigner(address,uint256)" \
    "<trusted_signer_address>" "<trusted_signer_expiration_timestamp>"
```

### Upgrade

The UUPSUpgradeable feature adds functions to the cocntract which support upgrading through the use of an UUPS/ERC1967Proxy. A function can be defined to migrate state if needed. Be careful of changing storage slots when upgrading. See [Documentation](https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable) for more details.
In addition, the private key is necessary or contracts will be deployed to different addresses than expected.

```shell
forge script script/PythLazerDeploy.s.sol --rpc-url <your_rpc_url> --private-key <your_private_key> --broadcast --sig "migrate()"
```

### Cast

```shell
cast <subcommand>
```

### Help

```shell
forge --help
anvil --help
cast --help
```
