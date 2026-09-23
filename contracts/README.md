# Settleva Contracts

The contract layer is deliberately split into two trust boundaries.

## Reclaim verifier boundary

`IReclaimVerifier` models the current Reclaim Solidity verifier entry point: a proof is submitted and a successful call means the verifier accepted the proof. Reclaim's Solidity documentation shows this integration pattern. citeturn0search0

`ReclaimVerifierAdapter` adds Settleva-specific binding:

1. The expected provider must match.
2. The Reclaim verifier must accept the proof.
3. The proof context hash must exactly match the context committed by the Settleva application.

The adapter does not interpret a normal API response as proof.

## Important deployment gate

The adapter is not the Reclaim verifier itself. A real Arc deployment address must be configured before production deployment. The build must first establish a real proof verification transaction on Arc testnet/mainnet as required by the project brief.

Arc mainnet is EVM-compatible and uses chain ID 5042. citeturn3search0turn4search0
