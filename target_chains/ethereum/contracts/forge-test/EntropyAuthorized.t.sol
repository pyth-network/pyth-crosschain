// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "./utils/EntropyTestUtils.t.sol";
import "../contracts/entropy/EntropyUpgradable.sol";
import "./utils/InvalidMagic.t.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@pythnetwork/entropy-sdk-solidity/EntropyErrors.sol";

contract EntropyAuthorized is Test, EntropyTestUtils {
    ERC1967Proxy public proxy;
    EntropyUpgradable public random;
    EntropyUpgradable public random2;
    InvalidMagic public randomDifferentMagic;

    address public owner = address(1);
    address public admin = address(2);
    address public admin2 = address(3);

    // We don't need to register providers for these tests
    // We are just checking for the default provider, which
    // only required an address.
    address public provider1 = address(4);
    address public provider2 = address(5);

    address public owner2 = address(6);

    uint128 pythFeeInWei = 7;

    function setUp() public {
        EntropyUpgradable _random = new EntropyUpgradable();
        // deploy proxy contract and point it to implementation
        proxy = new ERC1967Proxy(address(_random), "");
        // wrap in ABI to support easier calls
        random = EntropyUpgradable(address(proxy));
        // to test for upgrade
        random2 = new EntropyUpgradable();
        randomDifferentMagic = new InvalidMagic();

        random.initialize(owner, admin, pythFeeInWei, provider1, false);
    }

    function testSetPythFeeByAdmin() public {
        vm.prank(admin);
        random.setPythFee(10);
        assertEq(random.getPythFee(), 10);
    }

    function testSetPythFeeByOwner() public {
        vm.prank(owner);
        random.setPythFee(10);
        assertEq(random.getPythFee(), 10);
    }

    function testExpectRevertSetPythFeeByUnauthorized() public {
        vm.expectRevert(EntropyErrors.Unauthorized.selector);
        vm.prank(admin2);
        random.setPythFee(10);
    }

    function testSetDefaultProviderByOwner() public {
        vm.prank(owner);
        random.setDefaultProvider(provider2);
        assertEq(random.getDefaultProvider(), provider2);
    }

    function testSetDefaultProviderByAdmin() public {
        vm.prank(admin);
        random.setDefaultProvider(provider2);
        assertEq(random.getDefaultProvider(), provider2);
    }

    function testExpectRevertSetDefaultProviderByUnauthorized() public {
        vm.expectRevert(EntropyErrors.Unauthorized.selector);
        vm.prank(admin2);
        random.setDefaultProvider(provider2);
    }

    function testUpgradeByOwner() public {
        vm.prank(owner);
        random.upgradeTo(address(random2));
    }

    function testExpectRevertUpgradeByAdmin() public {
        // The message is returned by openzepplin upgrade contracts
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(admin);
        random.upgradeTo(address(random2));
    }

    function testExpectRevertUpgradeByUnauthorized() public {
        // The message is returned by openzepplin upgrade contracts
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(provider1);
        random.upgradeTo(address(random2));
    }

    // There can be another case that the magic function doesn't
    // exist but it's fine. (It will revert with no reason)
    // The randomDifferentMagic contract do have a magic in this case
    function testExpectRevertDifferentMagicContractUpgrade() public {
        vm.expectRevert(EntropyErrors.InvalidUpgradeMagic.selector);
        vm.prank(owner);
        random.upgradeTo(address(randomDifferentMagic));
    }

    function testExpectRevertRequestOwnershipTransferByUnauthorized() public {
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(provider1);
        random.transferOwnership(owner2);
    }

    function testExpectRevertRequestOwnershipTransferByAdmin() public {
        vm.expectRevert("Ownable: caller is not the owner");
        vm.prank(admin);
        random.transferOwnership(owner2);
    }

    function testRequestAndAcceptOwnershipTransfer() public {
        vm.prank(owner);
        random.transferOwnership(owner2);
        assertEq(random.pendingOwner(), owner2);

        vm.prank(owner2);
        random.acceptOwnership();
        assertEq(random.owner(), owner2);
    }

    function testRequestAndAcceptOwnershipTransferUnauthorizedAccept() public {
        vm.prank(owner);
        random.transferOwnership(owner2);
        assertEq(random.pendingOwner(), owner2);

        vm.prank(admin);
        vm.expectRevert("Ownable2Step: caller is not the new owner");
        random.acceptOwnership();
    }

    function testProposeAdminByOwner() public {
        vm.prank(owner);
        random.proposeAdmin(admin2);

        assertEq(random.proposedAdmin(), admin2);
    }

    function testProposeAdminByAdmin() public {
        vm.prank(admin);
        random.proposeAdmin(admin2);

        assertEq(random.proposedAdmin(), admin2);
    }

    function testProposeAdminByUnauthorized() public {
        vm.expectRevert(EntropyErrors.Unauthorized.selector);
        random.proposeAdmin(admin2);
    }

    function testAcceptAdminByPropsed() public {
        vm.prank(owner);
        random.proposeAdmin(admin2);

        vm.prank(admin2);
        random.acceptAdmin();

        assertEq(random.getAdmin(), admin2);
    }

    function testAcceptAdminByUnauthorized() public {
        vm.prank(owner);
        random.proposeAdmin(admin2);

        vm.prank(provider1);
        vm.expectRevert(EntropyErrors.Unauthorized.selector);
        random.acceptAdmin();
    }
}
