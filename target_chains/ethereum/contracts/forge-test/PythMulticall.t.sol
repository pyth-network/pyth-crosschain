
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "forge-std/Test.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "./utils/WormholeTestUtils.t.sol";
import "./utils/PythTestUtils.t.sol";
import "./utils/RandTestUtils.t.sol";
import "../../sdk/solidity/PythMulticall.sol";

contract PythMulticallTest is Test, WormholeTestUtils, PythTestUtils {
    IPyth public pyth;

}

contract SampleContract is PythMulticall {
    constructor(pythAddress)
}
