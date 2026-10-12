# Settleva

Settleva is developer infrastructure for policy-based, evidence-driven USDC settlement on Arc.

> Define what must be proven. Verify the evidence. Settle the payment.

## Product model

An application defines a condition for each payment. The SDK canonicalizes the policy and prepares a payment commitment. An authoritative evidence provider supplies proof; the backend verifies provider/version, payment context and claims, protects against replay, and signs a settlement attestation. The shared Settleva contract holds USDC and enforces release authorization, expiry and eligible refunds.

The four featured scenarios—gaming rewards, freelance milestones, conditional commerce and agentic task settlement—are different policies over the same payment infrastructure. They do not require separate Settleva contracts.

## Current verified scope

The repository contains the shared settlement contract, SDK helpers, a Reclaim verification backend, a source-signed evidence endpoint, persistent replay protection, and a website playground. CI passed on main at `2b698d5e07e4ec9e0955616f4a88c50c55997397` in [workflow run 38310472629](https://github.com/Investorquab/Settleva/actions/runs/38310472629); this confirms code checks, tests and build, not a production deployment. The Reclaim pipeline resolves an adapter against the exact provider ID/version committed in each payment condition, verifies Reclaim cryptography and TEE attestation, binds the proof to its session/payment/condition, normalizes source fields, evaluates the generic condition, enforces replay protection, and signs a payment-bound settlement attestation.

The separate endpoint at `POST /api/evidence/attest` supports authoritative source backends that sign events using Ed25519. It is a server-to-server integration boundary, not a set of ready-made gaming, freelance, commerce, or agentic integrations. It verifies a timestamped signature over exact request bytes, provider ID/version, condition hash, exact claim field set, on-chain funded payment, contract signer, and persistent replay protection before issuing the same contract attestation. Each source still requires a real server-side key registration and a trustworthy outcome integration. The four featured scenarios are not automatically live because this shared protocol exists.

The existing Reclaim-backed GitHub deployment adapter remains the concrete example used by the separate /live console. Additional Reclaim sources require an explicit server-side SETTLEVA_RECLAIM_ADAPTERS mapping and a published, validated Reclaim provider that independently proves the event. The contract's release path is backend-attested settlement, not trustless on-chain verification of external proofs.

## Repository

- apps/web: locked landing page/playground, independent /live Arc mainnet settlement console, and verification API routes.
- packages/sdk: deterministic payment preparation, amount conversion, viem transaction-call builders and attestation hashing.
- packages/conditions: condition schema, canonicalization, hashing and exact-claim evaluation.
- packages/providers: evidence-provider adapters.
- packages/verification: verified-data binding and persistent replay protection.
- contracts: one shared Settleva contract and Solidity tests.
- docs: architecture, trust boundaries, Arc readiness, deployment notes and signed-evidence provider guide.

## Playground

The homepage playground uses the actual condition canonicalizer and evaluator against editable JSON policy/evidence examples. It is local simulation only: it does not verify a real provider proof, sign an attestation, connect a wallet or transfer USDC.

The separate /live route is the actual Arc mainnet transaction console and currently uses the Reclaim-backed GitHub deployment adapter as its concrete example. Before asking for an approval or funding transaction, it calls a server-side readiness endpoint to check the deployed contract/signer, canonical USDC interface, registered exact provider/version, callback configuration and database schema. The source-signed API is an integration endpoint for trusted partner backends; it does not submit token transfers itself. Do not claim the flow is live until a deployed contract and real provider-to-release transaction have been validated on Arc mainnet.

## Development

Requirements: Node.js 22+, pnpm 10.15.0, and Circle's Arc Foundry for Arc-specific Solidity testing. Use a pinned Arc Foundry release rather than upstream foundryup for Arc-specific contract tests.

From the repository root:

    pnpm install --frozen-lockfile
    pnpm check
    pnpm test
    pnpm build

In an Ubuntu/WSL shell with arc-forge installed, from contracts/:

    FOUNDRY_PROFILE=arc arc-forge install foundry-rs/forge-std
    FOUNDRY_PROFILE=arc arc-forge build --sizes
    FOUNDRY_PROFILE=arc arc-forge test -vvv

Start with the [Documentation Index](docs/README.md), which explains the purpose, visibility, and current limits of each guide. Key references include [Architecture](docs/ARCHITECTURE.md), [Architecture Lock](docs/ARCHITECTURE_LOCK.md), [Arc Readiness Audit](docs/ARC_READINESS_AUDIT.md), [Mainnet Deployment Runbook](docs/MAINNET_DEPLOYMENT_RUNBOOK.md), [Signed Evidence Provider Integration](docs/integrations/SIGNED_EVIDENCE_PROVIDERS.md), [contracts README](contracts/README.md), and [SDK README](packages/sdk/README.md).

## Security and production gates

The browser is not a trust authority. Never place provider credentials, database credentials, private keys or backend signing keys in public environment variables. Never treat arbitrary API JSON, client-supplied booleans or simulated evidence as proof. The signed-evidence endpoint trusts only the registered Ed25519 key for the exact provider ID/version, and rejects stale, altered, replayed or incorrectly bound events.

Before issuing a settlement attestation, the backend must validate an authoritative source event, bind it to the committed payment condition, evaluate verified claims and confirm the live Arc contract contains a funded payment whose condition hash, provider hash and expiry match the requested policy. Database/RPC/configuration failures fail closed.

Mainnet readiness also requires secure production configuration, review of the contract's immutable verification signer, a deployed backend/database, an authoritative evidence provider for each enabled scenario, distributed ingress rate/concurrency limits, and a controlled end-to-end settlement transaction. Green CI or a playground simulation is not proof of production settlement. See [the signed-evidence integration guide](docs/integrations/SIGNED_EVIDENCE_PROVIDERS.md) for the source-to-server protocol and its trust boundary.
