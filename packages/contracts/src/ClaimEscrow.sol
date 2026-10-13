// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

contract ClaimEscrow {
    address public immutable owner;

    struct Escrow {
        address token;
        uint256 amount;
        address depositor;
        string lookupKey;
        bool claimed;
    }

    mapping(bytes32 => Escrow) public escrows;

    event EscrowCreated(
        bytes32 indexed paymentIdHash,
        address indexed token,
        address indexed depositor,
        uint256 amount,
        string lookupKey
    );
    event EscrowClaimed(
        bytes32 indexed paymentIdHash,
        address indexed recipient,
        uint256 amount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address owner_) {
        require(owner_ != address(0), "owner required");
        owner = owner_;
    }

    function createEscrow(
        bytes32 paymentIdHash,
        address token,
        uint256 amount,
        string calldata lookupKey
    ) external {
        require(paymentIdHash != bytes32(0), "payment required");
        require(token != address(0), "token required");
        require(amount > 0, "amount required");
        require(escrows[paymentIdHash].amount == 0, "escrow exists");

        bool ok = IERC20(token).transferFrom(msg.sender, address(this), amount);
        require(ok, "transfer failed");

        escrows[paymentIdHash] = Escrow({
            token: token,
            amount: amount,
            depositor: msg.sender,
            lookupKey: lookupKey,
            claimed: false
        });

        emit EscrowCreated(paymentIdHash, token, msg.sender, amount, lookupKey);
    }

    function claim(bytes32 paymentIdHash, address recipient) external onlyOwner {
        Escrow storage escrow = escrows[paymentIdHash];

        require(escrow.amount > 0, "escrow missing");
        require(!escrow.claimed, "already claimed");
        require(recipient != address(0), "recipient required");

        escrow.claimed = true;

        bool ok = IERC20(escrow.token).transfer(recipient, escrow.amount);
        require(ok, "transfer failed");

        emit EscrowClaimed(paymentIdHash, recipient, escrow.amount);
    }
}
