// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

contract SettlementRouter {
    event DirectSettlementRecorded(
        bytes32 indexed paymentIdHash,
        address indexed token,
        address indexed payer,
        address recipient,
        uint256 amount
    );

    function settleDirect(
        bytes32 paymentIdHash,
        address token,
        address recipient,
        uint256 amount
    ) external returns (bytes32 settlementId) {
        require(paymentIdHash != bytes32(0), "payment required");
        require(token != address(0), "token required");
        require(recipient != address(0), "recipient required");
        require(amount > 0, "amount required");

        bool ok = IERC20(token).transferFrom(msg.sender, recipient, amount);
        require(ok, "transfer failed");

        settlementId = keccak256(
            abi.encode(paymentIdHash, token, msg.sender, recipient, amount)
        );

        emit DirectSettlementRecorded(
            paymentIdHash,
            token,
            msg.sender,
            recipient,
            amount
        );
    }
}
