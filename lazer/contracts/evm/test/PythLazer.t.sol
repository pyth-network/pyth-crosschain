// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {PythLazer} from "../src/PythLazer.sol";

contract PythLazerTest is Test {
    PythLazer public pythLazer;

    function setUp() public {
        pythLazer = new PythLazer();
        pythLazer.initialize(address(1));
    }

    function test_update_add_signer() public {
        assert(!pythLazer.isValidSigner(address(2)));
        vm.prank(address(1));
        pythLazer.updateTrustedSigner(address(2), block.timestamp + 1000);
        assert(pythLazer.isValidSigner(address(2)));
        skip(2000);
        assert(!pythLazer.isValidSigner(address(2)));
    }

    function test_update_remove_signer() public {
        assert(!pythLazer.isValidSigner(address(2)));
        vm.prank(address(1));
        pythLazer.updateTrustedSigner(address(2), block.timestamp + 1000);
        assert(pythLazer.isValidSigner(address(2)));

        vm.prank(address(1));
        pythLazer.updateTrustedSigner(address(2), 0);
        assert(!pythLazer.isValidSigner(address(2)));
    }

    function test_verify() public {
        // Prepare dummy update and signer
        address trustedSigner = 0xEfEf56cD66896f6799A90A4e4d512C330c094e44;
        vm.prank(address(1));
        pythLazer.updateTrustedSigner(trustedSigner, 3000000000000000);
        bytes
            memory update = hex"2a22999a577d3cc0202197939d736bc0dcf71b9dde7b9470e4d16fa8e2120c0787a1c0d744d0c39cc372af4d1ecf2d09e84160ca905f3f597d20e2eec144a446a0459ad600001c93c7d3750006240af373971c01010000000201000000000005f5e100";

        uint256 fee = pythLazer.verification_fee();

        address alice = makeAddr("alice");
        vm.deal(alice, 1 ether);
        address bob = makeAddr("bob");
        vm.deal(bob, 1 ether);

        // Alice provides appropriate fee
        vm.prank(alice);
        pythLazer.verifyUpdate{value: fee}(update);
        assertEq(alice.balance, 1 ether - fee);

        // Alice overpays and is refunded
        vm.prank(alice);
        pythLazer.verifyUpdate{value: 0.5 ether}(update);
        assertEq(alice.balance, 1 ether - fee - fee);

        // Bob does not attach a fee
        vm.prank(bob);
        vm.expectRevert("Insufficient fee provided");
        pythLazer.verifyUpdate(update);
        assertEq(bob.balance, 1 ether);
    }
}
