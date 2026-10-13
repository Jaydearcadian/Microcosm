// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SettlementRouter} from "../src/SettlementRouter.sol";
import {ClaimEscrow} from "../src/ClaimEscrow.sol";

interface Vm {
    function envUint(string calldata) external returns (uint256);
    function envAddress(string calldata) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployArcContracts {
    Vm internal constant vm =
        Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    struct Deployment {
        address settlementRouter;
        address claimEscrow;
    }

    function run() external returns (Deployment memory deployment) {
        uint256 deployerKey = vm.envUint("ARC_SETTLEMENT_DEPLOYER_PRIVATE_KEY");
        address escrowOwner = vm.envAddress("ARC_CLAIM_ESCROW_OWNER");

        vm.startBroadcast(deployerKey);
        SettlementRouter settlementRouter = new SettlementRouter();
        ClaimEscrow claimEscrow = new ClaimEscrow(escrowOwner);
        vm.stopBroadcast();

        deployment = Deployment({
            settlementRouter: address(settlementRouter),
            claimEscrow: address(claimEscrow)
        });
    }
}
