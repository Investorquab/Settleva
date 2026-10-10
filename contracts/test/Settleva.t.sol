// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Settleva.sol";

contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount); require(balanceOf[from] >= amount);
        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount; return true;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount); balanceOf[msg.sender] -= amount; balanceOf[to] += amount; return true;
    }
}

contract SettlevaTest is Test {
    Settleva private settleva;
    MockToken private token;
    address private payer = address(0x1);
    address private payee = address(0x2);
    uint256 private signerPk = 0xA11CE;
    address private signer;
    bytes32 private paymentId = keccak256("payment-1");
    bytes32 private conditionHash = keccak256("canonical-condition");
    bytes32 private providerHash = keccak256("github-provider-id");
    bytes32 private proofIdentifier = keccak256("proof-1");

    function setUp() public {
        signer = vm.addr(signerPk);
        settleva = new Settleva(signer);
        token = new MockToken();
        token.mint(payer, 1_000_000);
        vm.prank(payer);
        token.approve(address(settleva), 1_000_000);
    }

    function _create() internal {
        vm.prank(payer);
        settleva.createPayment(paymentId, payee, address(token), 100_000, uint64(block.timestamp + 1 days), conditionHash, providerHash);
    }

    function _signature(bytes32 id, uint256 privateKey) internal returns (bytes memory) {
        bytes32 digest = keccak256(abi.encode(id, conditionHash, providerHash, proofIdentifier));
        bytes32 ethSignedDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, ethSignedDigest);
        return abi.encodePacked(r, s, v);
    }

    function _status(bytes32 id) internal view returns (uint256) {
        (, , , , , , , Settleva.Status status) = settleva.payments(id);
        return uint256(status);
    }

    function testCreateLocksFunds() public {
        _create();
        assertEq(token.balanceOf(address(settleva)), 100_000);
        assertEq(_status(paymentId), uint256(Settleva.Status.Funded));
    }

    function testReleaseRequiresPayee() public {
        _create();
        vm.expectRevert(Settleva.NotPayee.selector);
        settleva.release(paymentId, proofIdentifier, _signature(paymentId, signerPk));
    }

    function testReleaseRequiresVerificationAttestation() public {
        _create();
        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidVerificationSignature.selector);
        settleva.release(paymentId, proofIdentifier, hex"");
    }

    function testReleaseWithValidAttestationPaysPayee() public {
        _create();
        vm.prank(payee);
        settleva.release(paymentId, proofIdentifier, _signature(paymentId, signerPk));
        assertTrue(settleva.usedProofIdentifiers(proofIdentifier));
        assertEq(token.balanceOf(payee), 100_000);
        assertEq(_status(paymentId), uint256(Settleva.Status.Released));
    }

    function testWrongSignerReverts() public {
        _create();
        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidVerificationSignature.selector);
        settleva.release(paymentId, proofIdentifier, _signature(paymentId, 0xB0B));
    }

    function testAttestationBindsPaymentId() public {
        _create();
        bytes memory signature = _signature(paymentId, signerPk);
        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidVerificationSignature.selector);
        settleva.release(keccak256("different-payment"), proofIdentifier, signature);
    }

    function testAttestationBindsProofIdentifier() public {
        _create();
        bytes memory signature = _signature(paymentId, signerPk);
        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidVerificationSignature.selector);
        settleva.release(paymentId, keccak256("different-proof"), signature);
    }

    function testZeroProofIdentifierReverts() public {
        _create();
        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidProofIdentifier.selector);
        settleva.release(paymentId, bytes32(0), _signature(paymentId, signerPk));
    }

    function testCannotReleaseTwice() public {
        _create();
        vm.prank(payee);
        settleva.release(paymentId, proofIdentifier, _signature(paymentId, signerPk));
        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidStatus.selector);
        settleva.release(paymentId, proofIdentifier, _signature(paymentId, signerPk));
    }

    function testProofIdentifierCannotBeReusedAcrossPayments() public {
        _create();
        vm.prank(payee);
        settleva.release(paymentId, proofIdentifier, _signature(paymentId, signerPk));
        bytes32 secondPaymentId = keccak256("payment-2");
        vm.prank(payer);
        settleva.createPayment(secondPaymentId, payee, address(token), 50_000, uint64(block.timestamp + 1 days), conditionHash, providerHash);
        vm.prank(payee);
        vm.expectRevert(Settleva.ProofAlreadyUsed.selector);
        settleva.release(secondPaymentId, proofIdentifier, _signature(secondPaymentId, signerPk));
    }

    function testReleaseAfterExpiryReverts() public {
        _create();
        vm.warp(block.timestamp + 1 days);
        vm.prank(payee);
        vm.expectRevert(Settleva.Expired.selector);
        settleva.release(paymentId, proofIdentifier, _signature(paymentId, signerPk));
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

    function testAttestationHashHelperMatchesExpectedDigest() public {
        bytes32 expected = keccak256(abi.encode(paymentId, conditionHash, providerHash, proofIdentifier));
        assertEq(settleva.verificationAttestationHash(paymentId, conditionHash, providerHash, proofIdentifier), expected);
    }
}
