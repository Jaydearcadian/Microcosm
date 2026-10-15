// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProgrammableEnvelope} from "./ProgrammableEnvelope.sol";

/// @title EnvelopeFactory
/// @notice Deploys independently owned programmable spending envelopes for one token.
contract EnvelopeFactory {
    address public immutable token;
    address[] private _envelopes;
    mapping(address => address[]) private _ownerEnvelopes;

    event EnvelopeCreated(address indexed envelope, address indexed owner, address indexed token, uint256 index);

    constructor(address token_) {
        require(token_ != address(0), "FACTORY_TOKEN_REQUIRED");
        token = token_;
    }

    function createEnvelope(
        uint256 maxPerTransaction,
        uint256 maxPerDay,
        uint256 automaticApprovalLimit,
        uint8 allowedDaysMask,
        uint8 startHourUtc,
        uint8 endHourUtc,
        bool recipientAllowlistEnabled,
        address[] calldata initialRecipients,
        address[] calldata initialOperators
    ) external returns (address envelopeAddress) {
        ProgrammableEnvelope envelope = new ProgrammableEnvelope(
            msg.sender,
            token,
            maxPerTransaction,
            maxPerDay,
            automaticApprovalLimit,
            allowedDaysMask,
            startHourUtc,
            endHourUtc,
            recipientAllowlistEnabled,
            initialRecipients,
            initialOperators
        );
        envelopeAddress = address(envelope);
        uint256 index = _envelopes.length;
        _envelopes.push(envelopeAddress);
        _ownerEnvelopes[msg.sender].push(envelopeAddress);
        emit EnvelopeCreated(envelopeAddress, msg.sender, token, index);
    }

    function envelopeCount() external view returns (uint256) {
        return _envelopes.length;
    }

    function envelopeAt(uint256 index) external view returns (address) {
        return _envelopes[index];
    }

    function envelopesOf(address owner_) external view returns (address[] memory) {
        return _ownerEnvelopes[owner_];
    }
}
