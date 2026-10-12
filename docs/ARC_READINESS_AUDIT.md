# Arc Compatibility & Arc Microgrants Readiness

**Reviewed:** 2026-10-12  
**Source baseline:** `Investorquab/Settleva` main at `2b698d5e07e4ec9e0955616f4a88c50c55997397`. Workspace type-check, test suite, production build, PostgreSQL migration validation, and Arc Foundry contract tests passed in [CI run 38310472629](https://github.com/Investorquab/Settleva/actions/runs/38310472629). This is code/test evidence only, not production deployment evidence.  
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

The existing `/live` console's concrete evidence adapter is a Reclaim-backed GitHub deployment-status condition with five claims: repository full name, deployment ref, commit SHA, environment, and status. That path still requires a published, exact-version Reclaim provider validated with real app credentials. PR #7 also added `POST /api/evidence/attest`, a source-signed Ed25519 integration boundary for authoritative server backends. It has automated verification tests but is not a connected live source integration and is not wired into the `/live` UI.

**Unresolved evidence-source blocker:** the published Reclaim provider ID/version has not been evidenced as validated with real app credentials in this repository review. Its parameter names, extracted fields and payment-bound proof must be tested using the canonical [GitHub Deployment Status Provider guide](reclaim/GITHUB_DEPLOYMENT_STATUS_PROVIDER.md). A draft or public/static API response is insufficient. Alternatively, a source-signed path must register the real source's Ed25519 public key, connect an authoritative source service that signs true outcome events, and pass the equivalent source-specific positive and negative tests. Neither path is production-ready based on the API code alone.

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
| Arc Foundry test profile in CI | Passed on main in [CI run 38310472629](https://github.com/Investorquab/Settleva/actions/runs/38310472629) |
| Native/EVM USDC decimal distinction | Corrected: 18 native, 6 ERC-20 |
| Arc USDC-only contract/SDK/backend guard | Implemented; current main CI passed |
| Published Reclaim provider and exact version | Not evidenced as validated with real app credentials; blocker for the current `/live` path |
| Database schema migration and schema-aware preflight | Migration/schema checks passed in CI; production database migration and preflight are still required |
| `/live` wallet route | Reclaim/GitHub-specific path only; provider and deployment still require validation |
| Source-signed evidence API | Implemented and CI-tested; authoritative source and public-key registry not evidenced as configured |
| Deployed/verified Settleva contract on Arc mainnet | Deployment address/transaction and immutable signer verification are not recorded in this repository review |
| Full real USDC funding → evidence → attestation → release | Not evidenced; remains a launch blocker |
| Distributed edge rate/concurrency limits | Must be configured and validated at the production hosting edge |
| Public repository and builder profile | Available |
| Arc Microgrants submission | Not ready until live settlement evidence exists |

## Remaining order of operations

1. Preserve the green main CI baseline ([run 38310472629](https://github.com/Investorquab/Settleva/actions/runs/38310472629)) and continue running it for documentation changes.
2. Pull locally and run workspace checks; run Arc Foundry tests under WSL as above.
3. Choose the first use case and its source of truth. For the existing `/live` console, publish and validate the exact Reclaim provider/version and app credentials. For the source-signed API, connect the real authoritative source backend, register its Ed25519 public key, and run source-specific positive/negative tests.
4. Deploy one shared contract with separate deployer/verifier keys, verify its bytecode and `ARC_USDC()`/signer getters, then configure the production backend and database.
5. Apply the production database migration, pass the Reclaim-oriented `pnpm --filter @settleva/web preflight:mainnet` where applicable, and separately validate source-signed configuration.
6. Complete a controlled low-value mainnet escrow → authoritative evidence → backend attestation → payee release; also verify invalid/replayed evidence rejection and expiry refund with separate test payments.
7. The Arc Microgrants page currently states that submissions close October 14, 2026 at 23:59 ET; only submit if a working Arc mainnet deployment and real settlement can be demonstrated before that deadline.

This audit records readiness, not deployment evidence.
