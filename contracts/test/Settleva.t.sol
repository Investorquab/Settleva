// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Settleva.sol";

contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount);
        require(balanceOf[from] >= amount);
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount);
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockVerifier is IReclaimVerifier {
    bool public verified;

    function verifyProof(Proof calldata) external {
        verified = true;
    }
}

contract SettlevaTest is Test {
    Settleva private settleva;
    MockToken private token;
    MockVerifier private verifier;

    address private payer = address(0x1);
    address private payee = address(0x2);

    bytes32 private paymentId = keccak256("payment-1");
    bytes32 private conditionHash = keccak256(bytes("canonical-condition"));

    function setUp() public {
        verifier = new MockVerifier();
        settleva = new Settleva(address(verifier));
        token = new MockToken();

        token.mint(payer, 1_000_000);
        vm.prank(payer);
        token.approve(address(settleva), 1_000_000);
    }

    function _create() internal {
        vm.prank(payer);
        settleva.createPayment(
            paymentId,
            payee,
            address(token),
            100_000,
            uint64(block.timestamp + 1 days),
            conditionHash
        );
    }

    function _proof() internal view returns (IReclaimVerifier.Proof memory proof) {
        proof.claimInfo.provider = "github";
        proof.claimInfo.context = string.concat("github:merged:123:", vm.toString(conditionHash));
    }

    function testCreateLocksFunds() public {
        _create();
        assertEq(token.balanceOf(address(settleva)), 100_000);
        assertEq(uint256(settleva.payments(paymentId).status), uint256(Settleva.Status.Funded));
    }

    function testReleaseRequiresPayee() public {
        _create();

        vm.expectRevert(Settleva.NotPayee.selector);
        settleva.release(paymentId, _proof());
    }

    function testReleaseAfterProofVerification() public {
        _create();

        vm.prank(payee);
        settleva.release(paymentId, _proof());

        assertTrue(verifier.verified());
        assertEq(token.balanceOf(payee), 100_000);
        assertEq(uint256(settleva.payments(paymentId).status), uint256(Settleva.Status.Released));
    }

    function testWrongConditionReverts() public {
        _create();

        IReclaimVerifier.Proof memory proof = _proof();
        proof.claimInfo.context = string.concat("github:merged:wrong:", vm.toString(conditionHash));

        vm.prank(payee);
        vm.expectRevert(Settleva.ConditionMismatch.selector);
        settleva.release(paymentId, proof);
    }

    function testCannotReleaseTwice() public {
        _create();

        vm.prank(payee);
        settleva.release(paymentId, _proof());

        vm.prank(payee);
        vm.expectRevert(Settleva.InvalidStatus.selector);
        settleva.release(paymentId, _proof());
    }

    function testRefundAfterExpiry() public {
        _create();

        vm.warp(block.timestamp + 1 days);

        vm.prank(payer);
        settleva.refund(paymentId);

        assertEq(token.balanceOf(payer), 1_000_000);
        assertEq(uint256(settleva.payments(paymentId).status), uint256(Settleva.Status.Refunded));
    }

    function testCannotRefundBeforeExpiry() public {
        _create();

        vm.prank(payer);
        vm.expectRevert(Settleva.NotExpired.selector);
        settleva.refund(paymentId);
    }
}
