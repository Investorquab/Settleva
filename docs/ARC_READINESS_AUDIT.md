# Arc Compatibility & Deployment Readiness Audit

**Product lock:** Settleva is developer infrastructure. The SDK and reusable Solidity contract are the product. Each integrator deploys its own contract instance and selects its own verifier. The homepage playground remains a simulation, not a live escrow interface.

**Reclaim:** Deferred under `future-integrations/reclaim`. Reclaim is not required by the base SDK or the four website demonstrations.

## Verified software and distribution state

- Mainnet target chain ID configured in the repository: `5042`.
- The SDK and conditions packages are publicly released at `0.1.1`.
- A clean consumer project installed `@settleva/sdk@0.1.1`, resolved `@settleva/conditions@0.1.1`, and imported `prepareCreatePayment`, `buildApprovalCall`, and `buildCreatePaymentCall`.
- The release workflow completed staging through the configured npm Trusted Publisher path. Both npm packages were approved by the maintainer.
- GitHub's release workflow no longer references `NPM_TOKEN`; the temporary publishing credential was removed/revoked after the successful OIDC staging run.
- Repository CI and Arc Foundry contract tests passed on the release-preparation commit.

## Arc compatibility assumptions encoded in the repository

- Mainnet RPC configured: `https://rpc.mainnet.arc.io`.
- Explorer configured: `https://explorer.arc.io`.
- Canonical Arc USDC ERC-20 interface encoded in code: `0x3600000000000000000000000000000000000000`, six decimals.
- Native Arc USDC value/gas uses 18 decimals; ERC-20 escrow amounts use six.
- The canonical contract accepts only that ERC-20 interface.
- Use Circle's Arc Foundry for Arc-specific build and tests: https://github.com/circlefin/arc-foundry.

## Contract and evidence model

- The canonical `Settleva.sol` implementation is reusable by integrators.
- Each deployed instance has an immutable `verificationSigner`; changing it requires a replacement deployment.
- Keep the deployer key and verifier key separate. The verifier private key stays server-side.
- Each payment has its own amount, payee, expiry, condition hash, provider hash and status. A new payment does not require redeployment.
- Editing the terms of an already-funded payment is not supported by the current contract.
- The source-signed endpoint is a server-to-server protocol boundary. It is not a prebuilt integration for gaming, freelance, commerce or agentic products.
- The four homepage scenarios remain simulated until connected to authoritative sources and proven by real settlements.

## Deployment status

**No verified Settleva contract address, deployment transaction, or completed real source-to-release USDC settlement is recorded in the repository/runbook.** Package publication is complete, but it does not deploy a contract or prove funds can settle.

## Remaining sequence

1. On a clean checkout, run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, and `pnpm build`; in the contracts directory, use Circle Arc Foundry to build and test.
2. Select a dedicated deployment wallet and a separate verifier key. Keep both private keys out of chat, browser code, and source control.
3. Dry-run `script/Deploy.s.sol:DeploySettleva` against Arc mainnet. Confirm chain ID 5042, constructor signer, and deployer gas balance before deciding to broadcast.
4. If the dry run passes, deploy and record the verified transaction hash and contract address. Read back deployed bytecode, `verificationSigner()`, and `ARC_USDC()`.
5. Configure the backend and frontend with the exact deployment address and Arc settings; configure the verifier private key only server-side, set durable `DATABASE_URL`, apply migrations, then run `pnpm --filter @settleva/web preflight:mainnet`.
6. Select one real authoritative source and wire it into the signed-evidence adapter. Test source signature failures, stale evidence, nonqualifying claims, wrong payment/condition binding, and replay rejection.
7. Complete a controlled low-value Arc USDC funding → authentic evidence → backend attestation → payee release test. Record transaction hashes, the release event, terminal status, and actual balance changes. Separately test refund after expiry.
8. Only then describe a scenario as settlement-enabled. Keep unconnected demo scenarios labelled simulations.

