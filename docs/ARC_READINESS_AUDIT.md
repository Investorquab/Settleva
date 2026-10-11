# Arc Compatibility & Microgrants Readiness Audit

**Audit date:** 2026-10-11  
**Repository base reviewed:** `Investorquab/Settleva` at `23ed7019e7892c9e4806a764ba75e0ef63acefa6`  
**UI boundary:** `apps/web/app/page.tsx`, `apps/web/app/globals.css`, and `apps/web/app/layout.tsx` are locked. This audit does not authorize visual or page changes.

## Executive assessment

Settleva's core stack is directionally appropriate for Arc: Solidity contracts, TypeScript/Next.js, viem, Postgres for persistent replay protection, and Reclaim's SDK for off-chain proof verification. Arc is EVM-compatible, so a new programming model or wholesale stack replacement is not required.

There is, however, a **critical toolchain validation gap**: the previous CI workflow installed upstream Foundry and ran `forge test` without Arc execution semantics. Circle's own Arc Foundry repository explicitly warns against using `foundry-rs/foundry-toolchain` for Arc contract tests because it may execute with Ethereum rules while still passing. The repository therefore needed Arc Foundry pinned in CI, an Arc profile, and corrected local deployment/test instructions.

## Findings

### 1. Chain and token constants

Confirmed project constants:
- Arc mainnet chain ID: `5042`.
- Arc mainnet RPC: `https://rpc.mainnet.arc.io`.
- Arc explorer: `https://explorer.arc.io`.
- Arc USDC ERC-20 interface: `0x3600000000000000000000000000000000000000`, six decimals.

Important Arc distinction from Circle's compatibility guide:
- Native USDC balance/gas/value uses 18 decimals.
- ERC-20 USDC balance, approvals, `transfer`, and `transferFrom` use six decimals.
- These are two interfaces to the same underlying balance, not two separate assets.

The server-side viem chain metadata had mistakenly labelled native USDC as six decimals. The code fix in this audit changes its native currency metadata to 18 and adds a regression test. The preflight's ERC-20 USDC decimals check should remain six.

### 2. Arc Foundry and test strategy

Official references:
- Arc Foundry: https://github.com/circlefin/arc-foundry
- Release v0.8.0-2: https://github.com/circlefin/arc-foundry/releases/tag/v0.8.0-2
- Arc compatibility guide: https://www.arc.io/blog/arc-compatibility-guide-for-existing-evm-apps

Arc Foundry provides `arc-forge`, `arc-cast`, and `arc-anvil`. On Windows, the official precompiled-binary table lists Windows x86-64 as build-from-source; the Linux x86-64 glibc binary is suitable for Ubuntu/WSL. Arc Foundry is not installed by `foundryup`. The CI should download a pinned release, verify its published SHA-256, and run contract build/tests using `FOUNDRY_PROFILE=arc`.

Ordinary Foundry tests with a mock ERC-20 are useful unit tests but do not prove compatibility with Arc's native USDC behavior, system contracts, blocklist rules, or special event semantics. Settleva does not currently use payable native-value transfers or an indexer, so not every Arc compatibility edge applies. Before broad launch, it still needs an Arc-specific integration validation of the real USDC ERC-20 approval/funding/release flow and a real proof-to-attestation-to-release transaction.

### 3. Smart-contract architecture

Correct architectural choices:
- One shared `Settleva.sol` contract, with separate payment records for each use case.
- Payment commitments bind the payment ID, policy hash, provider hash, expiry and state.
- Release requires a backend-signed attestation; the contract checks the immutable signer and prevents proof reuse.
- The payer can refund after expiry; the payee can release only before expiry.

Security/trust boundary:
- This is backend-attested settlement, not trustless on-chain verification of Reclaim proofs. That must remain explicit in the documentation and demo.
- The verifier signer is immutable. Losing/rotating it requires deploying a replacement contract.
- The current contract accepts a token address supplied to `createPayment`. If Settleva is intended to enforce Arc USDC only, the contract must explicitly enforce the USDC address; if generic ERC-20 escrow is intentional, the product/docs must say so clearly. This choice should be resolved before the mainnet deployment because the contract is not mutable after deployment.

### 4. Proof provider and backend

The backend has good fail-closed principles: it pins provider/version, verifies through Reclaim, binds proof context to the session/payment/condition, evaluates extracted claims, checks the on-chain funded commitment, protects against replay with Postgres, and only then signs a contract-bound attestation.

Remaining blocker: Settleva still needs a **real, published Reclaim provider ID/version** that works with the configured app credentials and creates a fresh proof bound to an actual GitHub deployment-status event. Placeholder values, a draft/static API response, or a demo-only proof do not satisfy that requirement. Validate this before paying deployment gas or accepting funds.

### 5. User-facing app and current implementation scope

The current website playground is documented as a simulation: it evaluates local condition/evidence JSON and does not connect a wallet, verify a real provider proof, submit transactions, or transfer USDC. That is fine for a policy playground but, by itself, does not demonstrate live conditional settlement. The public submission should have a live Arc deployment that can be independently inspected, plus transaction evidence for at least one successful end-to-end lifecycle. This audit does not authorize a UI change; use the locked UI as-is and plan any product-facing integration separately.

### 6. Arc Microgrants: official requirements

Official event page: https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq

The page describes twenty `$500 USDC` microgrants from a `$10,000 USDC` pool. It says submissions close **October 14, 2026 at 23:59 ET** (October 15 at 04:59 Lagos time, WAT). It asks for:
- A live deployment on Arc mainnet with an openable link.
- A public repository.
- A short explanation of what the project does and what it uses Arc for.
- A public builder profile (GitHub, X, or Farcaster).

The event explicitly excludes testnet-only projects, mockups/slide decks, projects without an Arc component, and work already funded by a Circle or Arc program. It evaluates Arc relevance, technical credibility, quality of the build, and potential. Hackathon continuations are eligible. The work must be yours or you must have submission rights, and payout requires a wallet that can receive USDC on Arc.

**This is a mainnet-working-project requirement, not merely a source-code or CI requirement.** A green Vercel check or a GitHub deployment metadata record does not fulfill it.

## Readiness checklist

| Requirement | Assessment at audit time |
|---|---|
| Solidity/TypeScript stack fits Arc | Yes; no wholesale stack replacement needed |
| Chain ID/RPC correct | Yes |
| ERC-20 USDC address and decimals | Correct address; six decimals |
| Native USDC metadata | Correction required: 18 decimals |
| Arc-specific contract test toolchain | Correction required: use Arc Foundry, not upstream-only CI |
| One shared escrow contract for four use cases | Correct architectural direction |
| Real published pinned Reclaim provider | Not confirmed; launch blocker |
| Settleva contract deployed and verified on Arc mainnet | Not yet evidenced |
| Full live USDC funding -> proof -> attestation -> release | Not yet evidenced |
| Public repo | Available |
| Public live-project link showing actual Arc behavior | Not yet proven by simulation-only playground |
| UI changes | Out of scope without explicit permission |

## Recommended execution order

1. Pin Arc Foundry and checksum in CI, add the Arc profile, correct native USDC metadata, and use Arc Foundry commands in all repo instructions.
2. Run Arc-specific unit tests locally and in CI; then validate the real USDC ERC-20 path and deployment configuration against Arc-specific execution.
3. Confirm a published, dynamic Reclaim provider/version and run one real proof locally/staging without moving mainnet funds.
4. Resolve whether the contract is intentionally generic ERC-20 or USDC-only **before deployment**.
5. Deploy one shared Settleva contract to Arc mainnet, verify the bytecode and immutable signer, configure production backend/database/provider secrets, and pass `preflight:mainnet`.
6. Complete a controlled low-value mainnet test, preserve explorer transaction links and evidence, then submit the public app/repo/profile before the deadline.

No frontend visual/page file is part of this fix.  
