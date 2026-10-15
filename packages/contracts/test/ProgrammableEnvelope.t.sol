// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProgrammableEnvelope} from "../src/ProgrammableEnvelope.sol";
import {EnvelopeFactory} from "../src/EnvelopeFactory.sol";
import {MockERC20} from "../src/test/MockERC20.sol";

interface VmEnvelope {
    function prank(address) external;
    function startPrank(address) external;
    function stopPrank() external;
    function warp(uint256) external;
}

contract ProgrammableEnvelopeAssertions {
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

contract ProgrammableEnvelopeTest is ProgrammableEnvelopeAssertions {
    VmEnvelope internal constant vm = VmEnvelope(address(uint160(uint256(keccak256("hevm cheat code")))));

    MockERC20 internal token;
    ProgrammableEnvelope internal envelope;
    address internal owner = address(0xA11CE);
    address internal operator = address(0xB0B);
    address internal recipient = address(0xCAFE);
    address internal blockedRecipient = address(0xBAD);
    uint256 internal constant UNIT = 1_000_000; // six-decimal token
    bytes32 internal constant PAYMENT = keccak256("payment-1");

    function setUp() public {
        token = new MockERC20();
        address[] memory recipients = new address[](1);
        recipients[0] = recipient;
        address[] memory operators = new address[](1);
        operators[0] = operator;
        envelope = new ProgrammableEnvelope(
            owner,
            address(token),
            100 * UNIT,
            250 * UNIT,
            20 * UNIT,
            127,
            0,
            24,
            true,
            recipients,
            operators
        );
        token.mint(owner, 2_000 * UNIT);
        vm.startPrank(owner);
        token.approve(address(envelope), type(uint256).max);
        envelope.deposit(500 * UNIT);
        vm.stopPrank();
        vm.warp(4 days + 10 hours); // Monday 10:00 UTC
    }

    function testOperatorCanPayWithinAutomaticApprovalLimit() public {
        vm.prank(operator);
        envelope.executePayment(PAYMENT, recipient, 20 * UNIT);
        assertEq(token.balanceOf(recipient), 20 * UNIT);
        assertEq(envelope.spentByUtcDay(block.timestamp / 1 days), 20 * UNIT);
    }

    function testOperatorCannotExceedAutomaticApprovalLimit() public {
        vm.prank(operator);
        (bool ok,) = address(envelope).call(abi.encodeCall(envelope.executePayment, (PAYMENT, recipient, 20 * UNIT + 1)));
        assertTrue(!ok);
        assertEq(token.balanceOf(recipient), 0);
    }

    function testOwnerCanApproveLargerPaymentButStillWithinCaps() public {
        vm.prank(owner);
        envelope.executePayment(PAYMENT, recipient, 80 * UNIT);
        assertEq(token.balanceOf(recipient), 80 * UNIT);
    }

    function testDuplicatePaymentIdCannotBeExecutedTwice() public {
        vm.prank(owner);
        envelope.executePayment(PAYMENT, recipient, UNIT);
        vm.prank(owner);
        (bool ok,) = address(envelope).call(abi.encodeCall(envelope.executePayment, (PAYMENT, recipient, UNIT)));
        assertTrue(!ok);
        assertEq(token.balanceOf(recipient), UNIT);
    }

    function testPerTransactionLimitIsEnforcedForOwnerToo() public {
        vm.prank(owner);
        (bool ok,) = address(envelope).call(abi.encodeCall(envelope.executePayment, (PAYMENT, recipient, 100 * UNIT + 1)));
        assertTrue(!ok);
    }

    function testDailyLimitCannotBeExceededAcrossPayments() public {
        vm.prank(owner);
        envelope.executePayment(keccak256("first"), recipient, 100 * UNIT);
        vm.prank(owner);
        envelope.executePayment(keccak256("second"), recipient, 100 * UNIT);
        vm.prank(owner);
        (bool ok,) = address(envelope).call(abi.encodeCall(envelope.executePayment, (keccak256("third"), recipient, 51 * UNIT)));
        assertTrue(!ok);
        assertEq(envelope.spentByUtcDay(block.timestamp / 1 days), 200 * UNIT);
    }

    function testRecipientAllowlistIsEnforced() public {
        vm.prank(owner);
        (bool ok,) = address(envelope).call(abi.encodeCall(envelope.executePayment, (PAYMENT, blockedRecipient, UNIT)));
        assertTrue(!ok);
    }

    function testOperatorCannotPayWhenNotAuthorized() public {
        vm.prank(blockedRecipient);
        (bool ok,) = address(envelope).call(abi.encodeCall(envelope.executePayment, (PAYMENT, recipient, UNIT)));
        assertTrue(!ok);
    }

    function testScheduleDaysAndHoursAreEnforced() public {
        vm.prank(owner);
        envelope.setPolicy(100 * UNIT, 250 * UNIT, 20 * UNIT, uint8(1 << 1), 9, 17, true); // Tuesday, 09:00-17:00 UTC
        vm.prank(owner);
        (bool wrongDay,) = address(envelope).call(abi.encodeCall(envelope.executePayment, (PAYMENT, recipient, UNIT)));
        assertTrue(!wrongDay);
        vm.warp(5 days + 18 hours); // Tuesday 18:00 UTC
        vm.prank(owner);
        (bool wrongHour,) = address(envelope).call(abi.encodeCall(envelope.executePayment, (PAYMENT, recipient, UNIT)));
        assertTrue(!wrongHour);
        vm.warp(5 days + 10 hours);
        vm.prank(owner);
        envelope.executePayment(PAYMENT, recipient, UNIT);
        assertEq(token.balanceOf(recipient), UNIT);
    }

    function testPauseStopsPaymentsAndOwnerCanUnpause() public {
        vm.prank(owner);
        envelope.setPaused(true);
        vm.prank(owner);
        (bool pausedCall,) = address(envelope).call(abi.encodeCall(envelope.executePayment, (PAYMENT, recipient, UNIT)));
        assertTrue(!pausedCall);
        vm.prank(owner);
        envelope.setPaused(false);
        vm.prank(owner);
        envelope.executePayment(PAYMENT, recipient, UNIT);
        assertEq(token.balanceOf(recipient), UNIT);
    }

    function testOwnerCanWithdrawRemainingFunds() public {
        vm.prank(owner);
        envelope.withdraw(10 * UNIT, owner);
        assertEq(token.balanceOf(owner), 1_510 * UNIT);
        assertEq(envelope.availableBalance(), 490 * UNIT);
    }

}

contract EnvelopeFactoryTest is ProgrammableEnvelopeAssertions {
    VmEnvelope internal constant vm = VmEnvelope(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant UNIT = 1_000_000;
    address internal owner = address(0xA11CE);
    address internal operator = address(0xB0B);
    address internal recipient = address(0xCAFE);

    function testFactoryCreatesOwnerScopedEnvelope() public {
        MockERC20 token = new MockERC20();
        EnvelopeFactory factory = new EnvelopeFactory(address(token));
        address[] memory recipients = new address[](1);
        recipients[0] = recipient;
        address[] memory operators = new address[](1);
        operators[0] = operator;
        vm.prank(owner);
        address created = factory.createEnvelope(100 * UNIT, 250 * UNIT, 20 * UNIT, 127, 0, 24, true, recipients, operators);
        ProgrammableEnvelope createdEnvelope = ProgrammableEnvelope(created);
        assertEq(createdEnvelope.owner(), owner);
        assertEq(address(createdEnvelope.token()), address(token));
        assertEq(factory.envelopeCount(), 1);
        address[] memory owned = factory.envelopesOf(owner);
        assertEq(owned[0], created);
    }
}
