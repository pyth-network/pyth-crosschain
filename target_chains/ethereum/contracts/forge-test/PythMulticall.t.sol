pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "forge-std/Test.sol";

import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "./utils/WormholeTestUtils.t.sol";
import "./utils/PythTestUtils.t.sol";
import "./utils/RandTestUtils.t.sol";
import "@pythnetwork/pyth-sdk-solidity/PythMulticall.sol";
import "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

contract PythMulticallTest is Test {
    IPyth public pyth;
    SampleContract public multicallable;

    function setUp() public {
        pyth = new MockPyth(60, 1);
        multicallable = new SampleContract(address(pyth));
    }

    function testBasic() public {
        bytes[] memory updateData = new bytes[](0);
        bytes memory call = abi.encodeCall(SampleContract.incrementCounter, ());
        // bytes memory call = bytes.concat(multicallable.incrementCounter.selector);
        multicallable.updateFeedsAndCall(updateData, call);
        multicallable.incrementCounter();
    }
}

contract SampleContract is PythMulticall {
    address pyth;

    constructor(address _pyth) {
        pyth = _pyth;
    }

    function pythAddress() internal override returns (address p) {
        p = pyth;
    }

    function incrementCounter() external returns (int32 c) {
        c = 10;
    }
}
