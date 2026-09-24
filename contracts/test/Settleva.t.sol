// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Settleva.sol";

contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) { require(allowance[from][msg.sender] >= amount); require(balanceOf[from] >= amount); allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) { require(balanceOf[msg.sender] >= amount); balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true; }
}

contract MockVerifier is IReclaimVerifier {
    bool public verified;
    function verifyProof(Proof calldata) external { verified = true; }
}

contract SettlevaTest is Test {
    Settleva private settleva;
    MockToken private token;
    MockVerifier private verifier;
    address private payer = address(0x1);
    address private payee = address(0x2);
    uint256 private verificationSignerPk = 0xA11CE;
    address private verificationSigner;
    bytes32 private paymentId = keccak256("payment-1");
    bytes32 private conditionHash = keccak256(bytes("canonical-condition"));
    bytes32 private providerHash = keccak256(bytes("github"));
    bytes32 private proofIdentifier = keccak256("proof-1");

    function setUp() public {
        verifier = new MockVerifier();
        verificationSigner = vm.addr(verificationSignerPk);
        settleva = new Settleva(address(verifier), verificationSigner);
        token = new MockToken();
        token.mint(payer, 1_000_000);
        vm.prank(payer);
        token.approve(address(settleva), 1_000_000);
    }

    function _create() internal {
        vm.prank(payer);
        settleva.createPayment(paymentId, payee, address(token), 100_000, uint64(block.timestamp + 1 days), conditionHash, providerHash);
    }

    function _context(bytes32 id, bytes32 hash) internal pure returns (string memory) {
        return string.concat('{"contextAddress":"', vm.toString(id), '","contextMessage":"', vm.toString(hash), '"}');
    }

    function _proof() internal view returns (IReclaimVerifier.Proof memory proof) {
        proof.claimInfo.provider = "github";
        proof.claimInfo.context = _context(paymentId, conditionHash);
        proof.signedClaim.claim.identifier = proofIdentifier;
    }

    function _status(bytes32 id) internal view returns (uint256) {
        (, , , , , , , Settleva.Status status) = settleva.payments(id);
        return uint256(status);
    }

    function _signature(IReclaimVerifier.Proof memory proof, uint256 privateKey) internal returns (bytes memory) {
        bytes32 digest = keccak256(
            abi.encode(paymentId, conditionHash, providerHash, proof.signedClaim.claim.identifier)
        );
        bytes32 ethSignedDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedDigest);
        return abi.encodePacked(r, s, v);
    }

    function testCreateLocksFunds() public {
        _create();
        assertEq(token.balanceOf(address(settleva)), 100_000);
        assertEq(_status(paymentId), uint256(Settleva.Status.Funded));
    }

    function testReleaseRequiresPayee() public {
        _create();
        vm.expectRevert(Settleva.NotPayee.selector);
        settleva.release(paymentId, _proof(), _signature(_proof(), verificationSignerPk));
    }

    function testReleaseRequiresVerificationAttestation() public {
        _create();
        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidVerificationSignature.selector);
        settleva.release(paymentId, _proof(), hex"");
    }

    function testReleaseAfterProofVerificationAndAttestation() public {
        _create();
        IReclaimVerifier.Proof memory proof = _proof();
        bytes memory signature = _signature(proof, verificationSignerPk);
        vm.prank(payee);
        settleva.release(paymentId, proof, signature);
        assertTrue(verifier.verified());
        assertTrue(settleva.usedProofIdentifiers(proofIdentifier));
        assertEq(token.balanceOf(payee), 100_000);
        assertEq(_status(paymentId), uint256(Settleva.Status.Released));
    }

    function testWrongVerificationSignerReverts() public {
        _create();
        IReclaimVerifier.Proof memory proof = _proof();
        bytes memory signature = _signature(proof, 0xB0B);
        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidVerificationSignature.selector);
        settleva.release(paymentId, proof, signature);
    }

    function testAttestationBindsProofIdentifier() public {
        _create();
        IReclaimVerifier.Proof memory proof = _proof();
        bytes memory signature = _signature(proof, verificationSignerPk);
        proof.signedClaim.claim.identifier = keccak256("different-proof");
        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidVerificationSignature.selector);
        settleva.release(paymentId, proof, signature);
    }

    function testWrongProviderReverts() public {
        _create();
        IReclaimVerifier.Proof memory proof = _proof();
        proof.claimInfo.provider = "http";
        vm.prank(payee);
        vm.expectRevert(Settleva.ProviderMismatch.selector);
        settleva.release(paymentId, proof, _signature(proof, verificationSignerPk));
    }

    function testWrongConditionRevertsBeforeVerifierCall() public {
        _create();
        IReclaimVerifier.Proof memory proof = _proof();
        proof.claimInfo.context = _context(paymentId, keccak256(bytes("wrong-condition")));
        vm.prank(payee);
        vm.expectRevert(Settleva.ConditionMismatch.selector);
        settleva.release(paymentId, proof, _signature(proof, verificationSignerPk));
        assertFalse(verifier.verified());
    }

    function testWrongPaymentReverts() public {
        _create();
        IReclaimVerifier.Proof memory proof = _proof();
        proof.claimInfo.context = _context(keccak256("other-payment"), conditionHash);
        vm.prank(payee);
        vm.expectRevert(Settleva.ConditionMismatch.selector);
        settleva.release(paymentId, proof, _signature(proof, verificationSignerPk));
    }

    function testReleaseAfterExpiryRevertsBeforeVerifierCall() public {
        _create();
        IReclaimVerifier.Proof memory proof = _proof();
        vm.warp(block.timestamp + 1 days);
        vm.prank(payee);
        vm.expectRevert(Settleva.Expired.selector);
        settleva.release(paymentId, proof, _signature(proof, verificationSignerPk));
        assertFalse(verifier.verified());
    }

    function testZeroProofIdentifierRevertsBeforeVerifierCall() public {
        _create();
        IReclaimVerifier.Proof memory proof = _proof();
        proof.signedClaim.claim.identifier = bytes32(0);
        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidProofIdentifier.selector);
        settleva.release(paymentId, proof, _signature(proof, verificationSignerPk));
        assertFalse(verifier.verified());
    }

    function testMalformedSignatureReverts() public {
        _create();
        IReclaimVerifier.Proof memory proof = _proof();
        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidVerificationSignature.selector);
        settleva.release(paymentId, proof, hex"010203");
    }

    function testCannotReleaseTwice() public {
        _create();
        IReclaimVerifier.Proof memory proof = _proof();
        bytes memory signature = _signature(proof, verificationSignerPk);
        vm.prank(payee);
        settleva.release(paymentId, proof, signature);
        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidStatus.selector);
        settleva.release(paymentId, proof, signature);
    }

    function testProofIdentifierCannotBeReusedAcrossPayments() public {
        _create();
        IReclaimVerifier.Proof memory proof = _proof();
        bytes memory signature = _signature(proof, verificationSignerPk);
        vm.prank(payee);
        settleva.release(paymentId, proof, signature);

        bytes32 secondPaymentId = keccak256("payment-2");
        vm.prank(payer);
        settleva.createPayment(secondPaymentId, payee, address(token), 50_000, uint64(block.timestamp + 1 days), conditionHash, providerHash);

        IReclaimVerifier.Proof memory replay = _proof();
        replay.claimInfo.context = _context(secondPaymentId, conditionHash);
        bytes memory replaySignature = _signature(replay, verificationSignerPk);

        vm.prank(payee);
        vm.expectRevert(Settleva.ProofAlreadyUsed.selector);
        settleva.release(secondPaymentId, replay, replaySignature);
    }

    function testRefundAfterExpiry() public {
        _create();
        vm.warp(block.timestamp + 1 days);
        vm.prank(payer);
        settleva.refund(paymentId);
        assertEq(token.balanceOf(payer), 1_000_000);
        assertEq(_status(paymentId), uint256(Settleva.Status.Refunded));
    }

    function testCannotRefundBeforeExpiry() public {
        _create();
        vm.prank(payer);
        vm.expectRevert(Settleva.NotExpired.selector);
        settleva.refund(paymentId);
    }
}
