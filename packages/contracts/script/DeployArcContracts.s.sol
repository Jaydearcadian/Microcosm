// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SettlementRouter} from "../src/SettlementRouter.sol";
import {ClaimEscrow} from "../src/ClaimEscrow.sol";
import {EnvelopeFactory} from "../src/EnvelopeFactory.sol";

interface Vm {
    function envUint(string calldata) external returns (uint256);
    function envAddress(string calldata) external returns (address);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployArcContracts {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    struct Deployment {
        address settlementRouter;
        address claimEscrow;
        address envelopeFactory;
        address token;
    }

    function run() external returns (Deployment memory deployment) {
        uint256 deployerKey = vm.envUint("ARC_SETTLEMENT_DEPLOYER_PRIVATE_KEY");
        address token = vm.envAddress("ARC_USDC_ADDRESS");
        require(token != address(0), "USDC address required");

        vm.startBroadcast(deployerKey);
        SettlementRouter settlementRouter = new SettlementRouter();
        ClaimEscrow claimEscrow = new ClaimEscrow();
        EnvelopeFactory envelopeFactory = new EnvelopeFactory(token);
        vm.stopBroadcast();

        deployment = Deployment({
            settlementRouter: address(settlementRouter),
            claimEscrow: address(claimEscrow),
            envelopeFactory: address(envelopeFactory),
            token: token
        });
    }
}
