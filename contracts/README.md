# Settleva Contracts

The contract layer has two explicit verification boundaries.

## Reclaim proof boundary

`IReclaimVerifier` models the Reclaim Solidity verifier entry point. A successful verifier call establishes that the supplied proof passed Reclaim's cryptographic verification.

Settleva additionally binds the proof to the funded payment by checking:

1. The proof provider hash matches the funded provider.
2. Reclaim accepts the proof.
3. The signed Reclaim context is the exact context committed for the funded payment: `contextAddress = paymentId` and `contextMessage = conditionHash`.
4. The proof identifier has not already been used.

## Semantic verification boundary

Reclaim's verified `extractedParameters` still need to be evaluated against Settleva's structured condition. Reclaim's on-chain documentation also makes clear that proof verification is a separate boundary from application business logic.

Settleva therefore requires the backend verification service to sign a settlement attestation only after it has:

- verified the Reclaim proof;
- checked the pinned provider ID and exact provider version;
- checked the payment-bound context;
- evaluated every committed condition claim against the verified extracted parameters.

The on-chain contract verifies that attestation against the exact payment ID, condition hash, provider hash and Reclaim proof identifier. A payee cannot bypass semantic verification by submitting a valid Reclaim proof directly.

This signer is a deliberate trust boundary: compromise of the verification-signing key could authorize an invalid settlement. Production deployment therefore requires secure key management, rotation/revocation planning and an independent review of the verifier service.

## Arc mainnet deployment

Arc mainnet is chain ID `5042`. Circle lists Arc USDC as an ERC-20 at:

`0x3600000000000000000000000000000000000000`

Arc USDC uses 6 ERC-20 decimals. This is recorded as network configuration reference only; Settleva does not hardcode a token address into the settlement contract.

The deployment script intentionally requires explicit environment variables. No Reclaim verifier address is hardcoded because the exact verifier deployment must be confirmed for the target network before deployment.

Required deployment variables:

- `DEPLOYER_PRIVATE_KEY`
- `RECLAIM_VERIFIER`
- `VERIFICATION_SIGNER`

Deploy with Foundry after confirming the target network and RPC:

```bash
cd contracts
export DEPLOYER_PRIVATE_KEY=...
export RECLAIM_VERIFIER=0x...
export VERIFICATION_SIGNER=0x...
forge script script/Deploy.s.sol:DeploySettleva \
  --rpc-url "$ARC_MAINNET_RPC_URL" \
  --broadcast \
  -vvvv
```

Do not deploy until the Reclaim verifier address and the exact production provider ID/version have been independently verified.

## Important deployment gate

The contract still requires a real Reclaim verifier address and a real provider/version configuration before production deployment. The next production gate is an end-to-end Arc test using a real provider and real USDC, followed by security review.
