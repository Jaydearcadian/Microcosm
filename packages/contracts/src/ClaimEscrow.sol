// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title ClaimEscrow
/// @notice Recipient-bound token escrow with a depositor refund after expiry.
/// @dev No email, phone number, or other offchain lookup key is stored onchain.
contract ClaimEscrow {
    struct Escrow {
        address token;
        uint256 amount;
        address depositor;
        address recipient;
        uint64 expiresAt;
        bool claimed;
        bool refunded;
        bool exists;
    }

    mapping(bytes32 => Escrow) public escrows;
    uint256 private _entered;

    event EscrowCreated(bytes32 indexed paymentIdHash, address indexed token, address indexed depositor, address recipient, uint256 amount, uint64 expiresAt);
    event EscrowClaimed(bytes32 indexed paymentIdHash, address indexed recipient, uint256 amount);
    event EscrowRefunded(bytes32 indexed paymentIdHash, address indexed depositor, uint256 amount);

    modifier nonReentrant() {
        require(_entered == 0, "ESCROW_REENTRANT");
        _entered = 1;
        _;
        _entered = 0;
    }

    function createEscrow(
        bytes32 paymentIdHash,
        address token,
        address recipient,
        uint256 amount,
        uint64 expiresAt
    ) external nonReentrant {
        require(paymentIdHash != bytes32(0), "ESCROW_PAYMENT_REQUIRED");
        require(token != address(0), "ESCROW_TOKEN_REQUIRED");
        require(recipient != address(0), "ESCROW_RECIPIENT_REQUIRED");
        require(amount > 0, "ESCROW_AMOUNT_REQUIRED");
        require(expiresAt > block.timestamp, "ESCROW_EXPIRY_REQUIRED");
        require(!escrows[paymentIdHash].exists, "ESCROW_ALREADY_EXISTS");

        escrows[paymentIdHash] = Escrow({
            token: token,
            amount: amount,
            depositor: msg.sender,
            recipient: recipient,
            expiresAt: expiresAt,
            claimed: false,
            refunded: false,
            exists: true
        });
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "ESCROW_DEPOSIT_FAILED");
        emit EscrowCreated(paymentIdHash, token, msg.sender, recipient, amount, expiresAt);
    }

    function claim(bytes32 paymentIdHash) external nonReentrant {
        Escrow storage escrow = escrows[paymentIdHash];
        require(escrow.exists, "ESCROW_MISSING");
        require(!escrow.claimed && !escrow.refunded, "ESCROW_CLOSED");
        require(msg.sender == escrow.recipient, "ESCROW_NOT_RECIPIENT");
        require(block.timestamp <= escrow.expiresAt, "ESCROW_EXPIRED");

        escrow.claimed = true;
        require(IERC20(escrow.token).transfer(escrow.recipient, escrow.amount), "ESCROW_CLAIM_FAILED");
        emit EscrowClaimed(paymentIdHash, escrow.recipient, escrow.amount);
    }

    function refund(bytes32 paymentIdHash) external nonReentrant {
        Escrow storage escrow = escrows[paymentIdHash];
        require(escrow.exists, "ESCROW_MISSING");
        require(!escrow.claimed && !escrow.refunded, "ESCROW_CLOSED");
        require(msg.sender == escrow.depositor, "ESCROW_NOT_DEPOSITOR");
        require(block.timestamp > escrow.expiresAt, "ESCROW_NOT_EXPIRED");

        escrow.refunded = true;
        require(IERC20(escrow.token).transfer(escrow.depositor, escrow.amount), "ESCROW_REFUND_FAILED");
        emit EscrowRefunded(paymentIdHash, escrow.depositor, escrow.amount);
    }
}
