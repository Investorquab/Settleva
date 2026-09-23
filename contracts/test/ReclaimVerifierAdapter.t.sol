// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/IReclaimVerifier.sol";
import "../src/ReclaimVerifierAdapter.sol";

contract MockReclaimVerifier is IReclaimVerifier {
    bool public called;

    function verifyProof(Proof calldata) external {
        called = true;
    }
}

contract ReclaimVerifierAdapterTest is Test {
    MockReclaimVerifier private mock;
    ReclaimVerifierAdapter private adapter;

    function setUp() public {
        mock = new MockReclaimVerifier();
        adapter = new ReclaimVerifierAdapter(address(mock));
    }

    function testRejectsWrongProvider() public {
        IReclaimVerifier.Proof memory proof;
        proof.claimInfo.provider = "github";
        proof.claimInfo.context = "settleva:1:0xabc";

        vm.expectRevert(ReclaimVerifierAdapter.ProviderMismatch.selector);
        adapter.verify(proof, "http", keccak256(bytes(proof.claimInfo.context)));
        assertFalse(mock.called());
    }

    function testRejectsWrongContext() public {
        IReclaimVerifier.Proof memory proof;
        proof.claimInfo.provider = "github";
        proof.claimInfo.context = "settleva:1:wrong";

        vm.expectRevert(ReclaimVerifierAdapter.ContextMismatch.selector);
        adapter.verify(proof, "github", keccak256(bytes("settleva:1:right")));
        assertTrue(mock.called());
    }

    function testAcceptsVerifiedExactContext() public {
        IReclaimVerifier.Proof memory proof;
        proof.claimInfo.provider = "github";
        proof.claimInfo.context = "settleva:1:0xcondition";

        adapter.verify(
            proof,
            "github",
            keccak256(bytes("settleva:1:0xcondition"))
        );

        assertTrue(mock.called());
    }
}
