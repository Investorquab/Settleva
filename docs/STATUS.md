# Deployment status and evidence

**Status snapshot:** 14 October 2026  
**Code revision used for the demo:** [`3bf579d159658a0ad731a295bf2d3d8f91e43794`](https://github.com/Investorquab/Settleva/commit/3bf579d159658a0ad731a295bf2d3d8f91e43794)

This file records the verified deployment facts for the Settleva demonstration. It is not a security audit or a claim that every use case is production-integrated.

## Deployed instance

| Item | Verified value |
|---|---|
| Network | Arc mainnet |
| Chain ID | `5042` |
| Contract | `0x104E6D889875c5bac04c6a17cfb66d74b4638e95` |
| Deployment transaction | [`0xd1e46746f7c647dc2c4a749d6a0803edd1857585f3dc411209a91c659775c189`](https://explorer.arc.io/tx/0xd1e46746f7c647dc2c4a749d6a0803edd1857585f3dc411209a91c659775c189) |
| Immutable verification signer | `0xde98E7De50DBF3AFf588Ec510056Bd010cFc37Cf` |
| Arc USDC ERC-20 interface | `0x3600000000000000000000000000000000000000` |
| Website | [settleva.vercel.app](https://settleva.vercel.app) |
| Attestation API | [HTTPS endpoint](https://settleva-api.185-7-81-139.sslip.io/api/evidence/attest) |
| Published SDK packages | `@settleva/sdk@0.1.1`, `@settleva/conditions@0.1.1` |

The attestation endpoint accepts `POST /api/evidence/attest`. It intentionally returns `405` for GET at that route and `404` for unrelated paths on its dedicated hostname.

## Verification completed

- Arc reported chain ID `5042`; deployed bytecode was present.
- The contract's `verificationSigner()` matched the server verifier key, and `ARC_USDC()` matched the canonical Arc USDC interface.
- Mainnet preflight passed **19/19** checks, including the verifier address, RPC, USDC, contract, and replay database.
- The isolated API service was built and started on loopback and then exposed through the dedicated HTTPS route.
- The contract test suite previously passed **17** Arc Foundry tests.
- GitHub reported the Vercel deployment for commit `3bf579d` as successful.

## Controlled 0.01 USDC settlement test

The controlled test used the same wallet for payer and payee. It validates the contract/backend settlement mechanics, not a normal independent-payer/recipient customer workflow.

| Step | Result |
|---|---|
| USDC approval for 10,000 atomic units (0.01 USDC) | [Successful transaction](https://explorer.arc.io/tx/0xa233733383b8cf0336c8e2edd5718148d4546511a4d63980427c04937f7512f5) |
| Funded payment created | [Successful transaction](https://explorer.arc.io/tx/0x46c59b0a2c2ff582a0a180113f8a1ff3e69c16330b70ecea7bb6f2ba2c8cd164) |
| Attestation issued by the API | `verified: true`; payment and condition bindings matched |
| Release submitted by designated payee | [Successful transaction, block 25883227](https://explorer.arc.io/tx/0x445ee9c064d394ead51126abd4b0de76f165bd6a72c2fbecbce5877b15d831a7) |
| Final payment state | `Released (2)` |
| On-chain proof replay flag | `true` |
| Escrow contract token balance after release | `0` USDC |

Test payment ID:

```text
0xd5cc858af11ffd551dc9e338d16c651577242b6d1f6da3e386e56111a31fb30d
```

Test proof identifier:

```text
0xaf73d4ba6f2420ce176406a28d78e06456c7c8c9fcc83a464f68226f934ba38b
```

## Evidence-adapter limitation

For this test, a one-off script running on the VPS queried GitHub's live commit-status API and confirmed the Vercel status was successful. That script signed its assertion with an Ed25519 key generated for the test adapter and registered with the API.

This is **not a GitHub-signed Settleva message**. The signing key was controlled by the operator on the same VPS as the verifier, and the adapter script is not yet a reusable, committed provider integration. The test shows that an adapter can query an external status, submit a valid signed envelope, obtain a payment-bound attestation, and complete a release. It does not prove an independent source's signature or a production trust separation.

## Not yet verified as production-ready

- No committed, reusable, independently operated provider adapter is shipped for gaming, freelance, commerce, or agentic systems.
- The four homepage scenarios still use sample policy/evidence locally; they do not connect wallets or transfer funds.
- The acceptance test used a self-payment, not distinct payer and payee identities.
- Full negative-case acceptance for invalid/altered source signatures, stale requests, conflicting replay, and a separate expiry/refund payment has not been recorded as a complete live test run.
- Rate limiting, operational monitoring, and a documented recovery/backup procedure should be reviewed before treating the standalone endpoint as a production service.

The current public site and API are deployed, and the contract release path has been exercised with a real transaction. These facts should not be expanded into claims beyond the evidence above.
