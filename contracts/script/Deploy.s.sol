// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Settleva.sol";

contract DeploySettleva is Script {
    function run() external returns (Settleva settleva) {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address reclaimVerifier = vm.envAddress("RECLAIM_VERIFIER");
        address verificationSigner = vm.envAddress("VERIFICATION_SIGNER");

        require(reclaimVerifier != address(0), "RECLAIM_VERIFIER is zero");
        require(verificationSigner != address(0), "VERIFICATION_SIGNER is zero");

        vm.startBroadcast(deployerKey);
        settleva = new Settleva(reclaimVerifier, verificationSigner);
        vm.stopBroadcast();
    }
}
