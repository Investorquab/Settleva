# Arc Compatibility & Arc Microgrants Readiness

**Current product lock:** Settleva is developer infrastructure. The SDK and contract implementation are the product; each integrator may deploy its own instance and control the verifier address configured for that instance. The homepage playground is a simulation, not a live escrow interface.

**Reclaim status:** Deferred to future-integrations/reclaim. The Reclaim SDK, provider requirements and callback flow are not V1 blockers and must not be described as required to use the base SDK or the four demo scenarios.

**Latest confirmed main baseline before this product-lock branch:** CI passed on the documentation-audit commit. This new branch changes package metadata, retires the Reclaim runtime path, generalizes replay storage and updates docs. Those changes still require CI on this branch before merging.

## Arc compatibility assumptions

- Arc mainnet chain ID: 5042.
- RPC: https://rpc.mainnet.arc.io.
- Arc USDC ERC-20 interface: 0x3600000000000000000000000000000000000000, 6 decimals.
- Native Arc USDC used for gas/value uses 18 decimals; ERC-20 escrow transfers use six.
- The contract and SDK restrict escrow to the canonical Arc USDC ERC-20 interface.
- Use Circle's Arc Foundry for Arc-specific build/tests: https://github.com/circlefin/arc-foundry. An upstream Foundry run alone is not an Arc-compatibility result.

## Current architecture and status

- One canonical Solidity implementation is reusable by every integrator.
- Each integrator can deploy its own instance and choose the verifier address at construction.
- The deployer key and verifier private key must be separate. The verifier key stays server-side and is immutable for that contract instance.
- Each payment records its own amount, payee, expiry, condition hash, provider hash and status. Creating a new payment with a different condition does not require redeployment.
- Editing an already-funded payment's terms is not currently supported.
- The source-signed evidence endpoint is a server-to-server protocol boundary. It is not a ready-made integration for the four scenarios.
- Gaming rewards, freelance milestones, conditional commerce and agentic economy remain demo simulations until each has an authoritative source, a validated evidence path and a real Arc settlement test.
- The SDK package metadata is prepared for public npm publication, but package registry publication and a clean consumer installation remain outstanding.
- The previous main baseline had passing CI, but this branch is not yet CI-validated.
- No production contract address, completed real source-to-release settlement, or verified USDC balance movement is asserted by this document.

## Remaining order

1. Run CI for the product-lock branch and fix any check/test/build/Arc Foundry failures.
2. Publish @settleva/conditions followed by @settleva/sdk after successful checks and with authorized npm credentials.
3. Deploy a dedicated demo contract instance only after confirming the demo verifier key and completing a dry-run.
4. Configure and verify production environment, database migration, and provider-neutral preflight.
5. Choose one real source of truth, wire it to the verifier and test positive/negative/replay cases.
6. Complete one controlled low-value Arc USDC funding → verified evidence → attestation → release test and verify the actual on-chain result.
7. Record only verified links and facts in the submission. Do not describe the four local simulations as live integrations.
