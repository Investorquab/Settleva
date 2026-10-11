# Arc Compatibility & Arc Microgrants Readiness

**Reviewed:** 2026-10-11  
**Latest source baseline:** `Investorquab/Settleva` `c93fe8acf10e75c52b19a6e6b01e459bd52d6dc6`; follow-up implementation is being validated in CI.  
**UI protection:** The existing `apps/web/app/page.tsx`, `apps/web/app/globals.css`, and `apps/web/app/layout.tsx` are locked and must stay unchanged without explicit approval.

## Executive assessment

Settleva's stack fits Arc's EVM model: Solidity, TypeScript/Next.js, viem, Reclaim's SDK, and PostgreSQL for persistent session/replay protection. A wholesale rewrite is not needed. The important Arc distinction is native-USDC gas (18 decimals) versus the ERC-20 interface used for escrow (6 decimals). The project also needs Arc-specific contract testing: Circle explicitly says upstream Foundry can run Ethereum rules while tests pass, so this repository pins and runs Arc Foundry with `FOUNDRY_PROFILE=arc`.

## Official sources

- Arc Foundry: https://github.com/circlefin/arc-foundry
- Arc EVM compatibility guide: https://www.arc.io/blog/arc-compatibility-guide-for-existing-evm-apps
- Arc mainnet RPC: https://rpc.mainnet.arc.io
- Arc explorer: https://explorer.arc.io
- Arc Microgrants: https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq

## Correct chain/token assumptions

- Arc mainnet chain ID: `5042`.
- The documented Arc USDC ERC-20 interface is `0x3600000000000000000000000000000000000000`, 6 decimals.
- Native Arc USDC value/gas uses 18 decimals. These are two interfaces to the same underlying balance, not separate assets.
- The current contract defines `ARC_USDC()` and rejects any other ERC-20 address. SDK preparation and transaction helpers reject a non-USDC address, the server refuses an attestation for non-USDC payment records, and preflight checks the deployed getter.
- The deployer key and immutable verifier key must be distinct. The deployment script confirms `SETTLEVA_VERIFIER_PRIVATE_KEY` derives the supplied `VERIFICATION_SIGNER`.

## Arc Foundry

The CI workflow downloads the pinned Circle release `v0.8.0-2`, verifies its published SHA-256, installs `arc-forge`, `arc-cast`, and `arc-anvil`, then runs build/tests with `FOUNDRY_PROFILE=arc`. The Arc contract job has passed on the prior committed toolchain update.

Local Windows developers should use the Linux x86-64 Arc Foundry binary under Ubuntu/WSL 2, verify the checksum from the official releases, and run:

```bash
cd /mnt/c/Users/NEW/Desktop/Settleva/contracts
FOUNDRY_PROFILE=arc arc-forge install foundry-rs/forge-std
FOUNDRY_PROFILE=arc arc-forge build --sizes
FOUNDRY_PROFILE=arc arc-forge test -vvv
```

Do not substitute `foundryup`: that installs upstream Foundry, not Arc Foundry. Contract unit tests are still not a substitute for a real mainnet USDC integration test.

## Proof verification and trust boundary

The production adapter is limited to a Reclaim-backed GitHub deployment-status condition with these five claims: repository full name, deployment ref, commit SHA, environment, and status. The backend derives the corresponding dynamic provider parameters only from the condition committed to the escrow, pins the configured provider ID/version, verifies Reclaim proof signatures and app-secret TEE attestation, enforces timestamp freshness, binds context to session/payment/condition, evaluates claims, and uses persistent Postgres replay protection.

**Unresolved external blocker:** an actual published Reclaim provider ID/version must be configured and tested with the app credentials. The provider must accept the five parameter names documented in `docs/reclaim/SETTLEVA_PROVIDER_SPEC.md`, return the exact extracted fields, and produce a fresh payment-bound proof. A draft or public/static API response is insufficient. The code remains fail-closed until these account-side details are real.

The contract uses backend-attested settlement. It does not verify Reclaim proofs trustlessly on-chain; compromise of the immutable verifier key could authorize invalid release. That boundary must be described plainly in the submission.

## App behavior

The approved root page and its current styling were not changed. It remains a simulation playground and must not be presented as a real transfer.

A separate `/live` route was added as a functional interaction path. When the contract address and published Reclaim provider are configured it:
1. asks a wallet to switch to Arc mainnet;
2. validates the deployed USDC allowlist;
3. approves the exact ERC-20 amount and creates one escrow transaction;
4. requests Reclaim proof using the committed GitHub repository/ref/SHA/environment/status;
5. polls private status using a POST body token;
6. waits for server proof verification; then
7. lets only the designated payee submit release, or lets the original payer refund after expiry.

It displays links for the transaction receipts. It is **not considered live** until tested after deployment with a real proof and confirmed mainnet release. No provider, secrets, contract address or successful transaction is fabricated in code.

The database migration `pnpm --filter @settleva/web db:migrate` creates/reconciles the session/replay tables and partial unique indexes. CI runs it against a real PostgreSQL service. Production preflight checks required table/column/index presence as well as basic connectivity. Before either approval or funding transaction is requested, the live route calls `POST /api/reclaim/readiness`, which validates the committed condition/provider parameters, live Arc contract bytecode, Arc USDC decimals/allowlist, immutable signer, Reclaim app credentials/provider pin, HTTPS callback and replay schema. A failed readiness check prevents wallet transactions.

## Official Arc Microgrants requirements

Official page: https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq

The program offers twenty $500 USDC microgrants from a $10,000 pool. The official page says submissions close **October 14, 2026 at 23:59 ET** (October 15 at 04:59 Lagos time, WAT), and that applications are reviewed on a rolling basis. A submission must already be deployed and working on Arc mainnet, with one openable live link, a public repo, a short project/Arc-use description, and a public builder profile on GitHub, X, or Farcaster. Testnet-only builds, design mockups/slide decks, projects without an Arc component, and projects already funded by Circle/Arc are excluded.

Settleva's public repository and intended Arc relevance are in place. The mandatory **working mainnet deployment and demonstrated actual settlement** remain unproven and are release blockers. A GitHub CI evidence record, green Vercel check, or playground simulation is not a mainnet deployment.

## Readiness table

| Requirement | Current state |
|---|---|
| Arc EVM stack | Appropriate; no rewrite required |
| Arc Foundry test profile in CI | Implemented; prior Arc Foundry job passed |
| Native/EVM USDC decimal distinction | Corrected: 18 native, 6 ERC-20 |
| Arc USDC-only contract/SDK/backend guard | Added in this follow-up; verify via CI |
| Published Reclaim provider and exact version | Not confirmed; launch blocker |
| Database schema migration and schema-aware preflight | Added in this follow-up; verify via CI and run in production |
| Website route that supports real wallet flow | Added independently at `/live`; existing homepage files are preserved |
| Deployed/verified Settleva contract on Arc mainnet | Not yet evidenced |
| Full real USDC funding → proof → attestation → release | Not yet evidenced |
| Public repository and builder profile | Available |
| Arc Microgrants submission | Not ready until live settlement evidence exists |

## Remaining order of operations

1. Ensure this follow-up batch passes the full CI (workspace tests/build and Arc Foundry tests).
2. Pull locally and run workspace checks; run Arc Foundry tests under WSL as above.
3. Publish and validate the exact Reclaim provider and app credentials; verify positive and negative proofs.
4. Deploy one shared contract with separate deployer/verifier keys, verify its code and `ARC_USDC()`/signer getters, then configure the production backend and DB.
5. Run the DB migration and pass `pnpm --filter @settleva/web preflight:mainnet`.
6. Complete a controlled low-value mainnet escrow → Reclaim proof → backend attestation → payee release; also verify invalid proof rejection and expiry refund with separate test payments.
7. Submit the direct deployed `/live` link, repository, and description before the official cutoff.

This audit records readiness, not deployment evidence.
