// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../contracts/pulse/SchedulerUpgradeable.sol";

contract InvalidMagicPulseScheduler is SchedulerUpgradeable {
    function schedulerUpgradableMagic() public pure override returns (uint64) {
        return 0x12345678; // Different magic
    }
}

contract PulseSchedulerGovernanceTest is Test {
    ERC1967Proxy public proxy;
    SchedulerUpgradeable public scheduler;
    SchedulerUpgradeable public scheduler2;
    InvalidMagicPulseScheduler public schedulerInvalidMagic;
    
    address public owner = address(1);
    address public admin = address(2);
    address public admin2 = address(3);
    address public pyth = address(4);
    
    function setUp() public {
        SchedulerUpgradeable _scheduler = new SchedulerUpgradeable();
        // Deploy proxy contract and point it to implementation
        proxy = new ERC1967Proxy(address(_scheduler), "");
        // Wrap in ABI to support easier calls
        scheduler = SchedulerUpgradeable(address(proxy));
        
        // For testing upgrades
        scheduler2 = new SchedulerUpgradeable();
        schedulerInvalidMagic = new InvalidMagicPulseScheduler();
        
        scheduler.initialize(owner, admin, pyth);
    }
    
    function testGetAdmin() public {
        assertEq(scheduler.getAdmin(), admin);
    }
    
    function testProposeAdminByOwner() public {
        vm.prank(owner);
        scheduler.proposeAdmin(admin2);
        
        assertEq(scheduler.proposedAdmin(), admin2);
    }
    
    function testProposeAdminByAdmin() public {
        vm.prank(admin);
        scheduler.proposeAdmin(admin2);
        
        assertEq(scheduler.proposedAdmin(), admin2);
    }
    
    function testProposeAdminByUnauthorized() public {
        address unauthorized = address(5);
        vm.prank(unauthorized);
        vm.expectRevert("Unauthorized");
        scheduler.proposeAdmin(admin2);
    }
    
    function testAcceptAdminByProposed() public {
        vm.prank(owner);
        scheduler.proposeAdmin(admin2);
        
        vm.prank(admin2);
        scheduler.acceptAdmin();
        
        assertEq(scheduler.getAdmin(), admin2);
    }
    
    function testAcceptAdminByUnauthorized() public {
        vm.prank(owner);
        scheduler.proposeAdmin(admin2);
        
        address unauthorized = address(5);
        vm.prank(unauthorized);
        vm.expectRevert("Unauthorized");
        scheduler.acceptAdmin();
    }
    
    function testUpgradeByOwner() public {
        vm.prank(owner);
        scheduler.upgradeTo(address(scheduler2));
        
        // Verify version is updated
        assertEq(scheduler.version(), "1.0.0");
    }
    
    function testUpgradeByAdmin() public {
        vm.prank(admin);
        vm.expectRevert("Ownable: caller is not the owner");
        scheduler.upgradeTo(address(scheduler2));
    }
    
    function testUpgradeInvalidMagic() public {
        vm.prank(owner);
        vm.expectRevert("Invalid upgrade magic");
        scheduler.upgradeTo(address(schedulerInvalidMagic));
    }
    
    function testProposeZeroAddressAdmin() public {
        vm.prank(owner);
        vm.expectRevert("newAdmin is zero address");
        scheduler.proposeAdmin(address(0));
    }
    
    function testProposeThenChangeProposedAdmin() public {
        vm.prank(owner);
        scheduler.proposeAdmin(admin2);
        assertEq(scheduler.proposedAdmin(), admin2);
        
        address admin3 = address(6);
        vm.prank(admin);
        scheduler.proposeAdmin(admin3);
        assertEq(scheduler.proposedAdmin(), admin3);
    }
    
    function testAcceptAdminClearsProposedAdmin() public {
        vm.prank(owner);
        scheduler.proposeAdmin(admin2);
        
        vm.prank(admin2);
        scheduler.acceptAdmin();
        
        assertEq(scheduler.getAdmin(), admin2);
        assertEq(scheduler.proposedAdmin(), address(0));
    }
}
