// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SettlementRouter} from "../src/SettlementRouter.sol";
import {ClaimEscrow} from "../src/ClaimEscrow.sol";
import {MockERC20} from "../src/test/MockERC20.sol";

interface Vm {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
}

contract Assertions {
    function assertEq(uint256 left, uint256 right) internal pure {
        require(left == right, "uint mismatch");
    }
    function assertEq(address left, address right) internal pure {
        require(left == right, "address mismatch");
    }
    function assertTrue(bool value) internal pure {
        require(value, "assert true failed");
    }
}

contract SettlementFlowsTest is Assertions {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    SettlementRouter internal router;
    ClaimEscrow internal escrow;
    MockERC20 internal token;
    address internal payer = address(0xA11CE);
    address internal recipient = address(0xB0B);
    uint256 internal constant UNIT = 1_000_000;

    function setUp() public {
        router = new SettlementRouter();
        escrow = new ClaimEscrow();
        token = new MockERC20();
        token.mint(payer, 1_000 * UNIT);
        vm.startPrank(payer);
        token.approve(address(router), type(uint256).max);
        token.approve(address(escrow), type(uint256).max);
        vm.stopPrank();
        vm.warp(1_000_000);
    }

    function testSettleDirectTransfersFundsToRecipient() public {
        vm.prank(payer);
        router.settleDirect(keccak256("pay_1"), address(token), recipient, 25 * UNIT);
        assertEq(token.balanceOf(recipient), 25 * UNIT);
        assertEq(token.balanceOf(payer), 975 * UNIT);
    }

    function testOnlyNamedRecipientCanClaimAndCannotClaimTwice() public {
        bytes32 id = keccak256("escrow_claim");
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(payer);
        escrow.createEscrow(id, address(token), recipient, 40 * UNIT, expiry);

        vm.prank(payer);
        (bool wrongCaller,) = address(escrow).call(abi.encodeCall(escrow.claim, (id)));
        assertTrue(!wrongCaller);

        vm.prank(recipient);
        escrow.claim(id);
        assertEq(token.balanceOf(recipient), 40 * UNIT);
        (,,,,, bool claimed, bool refunded, bool exists) = escrow.escrows(id);
        assertTrue(claimed);
        assertTrue(!refunded);
        assertTrue(exists);

        vm.prank(recipient);
        (bool secondClaim,) = address(escrow).call(abi.encodeCall(escrow.claim, (id)));
        assertTrue(!secondClaim);
    }

    function testDepositorCanRefundAfterExpiry() public {
        bytes32 id = keccak256("escrow_refund");
        uint64 expiry = uint64(block.timestamp + 1 hours);
        vm.prank(payer);
        escrow.createEscrow(id, address(token), recipient, 40 * UNIT, expiry);
        vm.warp(uint256(expiry) + 1);
        vm.prank(payer);
        escrow.refund(id);
        // Payer started with 1_000 UNIT, escrowed 40 UNIT, got it back: whole again.
        assertEq(token.balanceOf(payer), 1_000 * UNIT);
        (,,,,, bool claimed, bool refunded, bool exists) = escrow.escrows(id);
        assertTrue(!claimed);
        assertTrue(refunded);
        assertTrue(exists);
    }
}
