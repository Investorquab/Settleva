# Settleva

Settleva is developer infrastructure for policy-based, evidence-driven USDC settlement on Arc.

> Define what must be proven. Verify the evidence. Settle the payment.

## Product model

An application defines a condition for each payment. The SDK canonicalizes the policy and prepares a payment commitment. An authoritative evidence provider supplies proof; the backend verifies provider/version, payment context and claims, protects against replay, and signs a settlement attestation. The shared Settleva contract holds USDC and enforces release authorization, expiry and eligible refunds.

The four featured scenarios—gaming rewards, freelance milestones, conditional commerce and agentic task settlement—are different policies over the same payment infrastructure. They do not require separate Settleva contracts.

## Current verified scope

The repository contains the shared settlement contract, SDK preparation and transaction helpers, a Reclaim verification backend, persistent replay protection, and a website playground. The shared live verification pipeline is provider-neutral: it resolves an adapter against the exact provider ID and version committed in each payment condition, verifies Reclaim cryptography and TEE attestation, binds the proof to the session/payment/condition, normalizes provider-specific fields, evaluates the generic condition, enforces replay protection, and signs a payment-bound settlement attestation. The original single-provider GitHub deployment adapter remains as a compatibility path. Other sources require an explicit server-side `SETTLEVA_RECLAIM_ADAPTERS` mapping and a published, validated Reclaim provider that independently proves the event. The gaming, freelance, commerce and agentic presets remain illustrative simulations until their source-specific proof integrations are implemented and validated.

The contract's release path uses a backend verification signer. It is **backend-attested settlement**, not trustless on-chain verification of external proofs.

## Repository

- `apps/web`: locked landing page/playground, an independent `/live` Arc mainnet settlement console, and Reclaim API routes.
- `packages/sdk`: deterministic payment preparation, amount conversion, viem transaction-call builders and attestation hashing.
- `packages/conditions`: condition schema, canonicalization, hashing and exact-claim evaluation.
- `packages/providers`: evidence-provider adapters.
- `packages/verification`: verified-data binding and persistent replay protection.
- `contracts`: one shared Settleva contract and Solidity tests.
- `docs`: architecture, trust boundaries, Arc readiness, and deployment notes.

## Playground

The homepage playground uses the repository's actual condition canonicalizer and evaluator against editable JSON policy/evidence examples. It supports guided and developer modes and reports policy/evidence errors. It is local simulation only: it does not verify a real provider proof, sign an attestation, connect a wallet or transfer USDC.

The separate `/live` route is the actual Arc mainnet transaction console and currently presents the GitHub deployment adapter as its concrete integration example. Before asking for an approval or funding transaction, it calls a server-side readiness endpoint that checks the deployed contract/signer, canonical USDC interface, registered exact provider/version, callback configuration and database schema. The shared API accepts other source adapters only when their provider ID/version and mappings are explicitly configured server-side; the repository does not currently include validated live gaming, freelance, commerce or agentic proof sources. Approval, funding, release and expiry-refund transactions link to the Arc explorer. Do not claim the flow is live until the deployed contract and a real provider-to-release transaction have been validated on Arc mainnet.

## Development

Requirements: Node.js 22+, pnpm 10.15.0, and [Circle's Arc Foundry](https://github.com/circlefin/arc-foundry) for Arc-specific Solidity testing. Use a pinned Arc Foundry release, not `foundryup`, for the Arc-specific test toolchain. Circle documents that upstream Foundry CI does not test Arc execution semantics.

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

In an Ubuntu/WSL shell with `arc-forge` installed, from `contracts/`:

```sh
FOUNDRY_PROFILE=arc arc-forge install foundry-rs/forge-std
FOUNDRY_PROFILE=arc arc-forge build --sizes
FOUNDRY_PROFILE=arc arc-forge test -vvv
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ARCHITECTURE_LOCK.md](docs/ARCHITECTURE_LOCK.md), [docs/ARC_READINESS_AUDIT.md](docs/ARC_READINESS_AUDIT.md), [docs/MAINNET_DEPLOYMENT_RUNBOOK.md](docs/MAINNET_DEPLOYMENT_RUNBOOK.md), [packages/sdk/README.md](packages/sdk/README.md), and [contracts/README.md](contracts/README.md).

## Security and production gates

The browser is not a trust authority. Never place provider credentials, database credentials, private keys or backend signing keys in public environment variables. Never treat arbitrary API JSON, client-supplied booleans or simulated evidence as proof.

Before issuing a settlement attestation, the backend must verify the Reclaim proof against the pinned provider/version, bind it to the initiated session and payment context, evaluate verified extracted claims, and confirm the live Arc contract contains a funded payment whose condition hash, provider hash and expiry match the requested policy. Database/RPC/configuration failures fail closed.

Mainnet readiness additionally requires secure production configuration, review of the contract's immutable verification signer, a deployed backend/database, a published and validated authoritative evidence provider, and a controlled end-to-end settlement transaction. A passing CI run or successful playground simulation is not proof of production settlement.
