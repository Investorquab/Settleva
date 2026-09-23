# Settleva Contracts

The contract layer has two explicit verification boundaries.

## Reclaim proof boundary

`IReclaimVerifier` models the Reclaim Solidity verifier entry point. A successful verifier call establishes that the supplied proof passed Reclaim's cryptographic verification. Reclaim's Solidity documentation shows this integration pattern. citeturn0search0

Settleva additionally binds the proof to the funded payment by checking:

1. The proof provider hash matches the funded provider.
2. Reclaim accepts the proof.
3. The signed proof context contains the funded payment ID.
4. The signed proof context contains the funded condition hash.
5. The proof identifier has not already been used.

## Semantic verification boundary

Reclaim's verified `extractedParameters` still need to be evaluated against Settleva's structured condition. Reclaim documents `extractedParameters` as the verified data returned from a proof and notes that `verifyProof` itself is stateless, so application business logic and replay/session controls remain the caller's responsibility. citeturn2search1turn2search4

Settleva therefore requires the backend verification service to sign a short-lived settlement attestation after it has:

- verified the Reclaim proof;
- checked the pinned provider ID and exact provider version;
- checked the payment-bound context;
- evaluated every committed condition claim against the verified extracted parameters.

The on-chain contract verifies that attestation against the exact payment ID, condition hash, provider hash and Reclaim proof identifier. A payee cannot bypass semantic verification by submitting a valid Reclaim proof directly.

This signer is a deliberate trust boundary: compromise of the verification-signing key could authorize an invalid settlement. Production deployment therefore requires secure key management, rotation/revocation planning and an independent review of the verifier service.

## Important deployment gate

The contract still requires a real Reclaim verifier address and a real provider/version configuration before production deployment. The next production gate is an end-to-end Arc test using a real provider and real USDC, followed by security review.
