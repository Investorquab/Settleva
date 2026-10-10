// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Settleva.sol";

contract DeploySettleva is Script {
    function run() external returns (Settleva settleva) {
        require(block.chainid == 5042, "wrong chain: expected Arc mainnet");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address verificationSigner = vm.envAddress("VERIFICATION_SIGNER");
        require(verificationSigner != address(0), "VERIFICATION_SIGNER is zero");

        vm.startBroadcast(deployerKey);
        settleva = new Settleva(verificationSigner);
        vm.stopBroadcast();
    }
}
