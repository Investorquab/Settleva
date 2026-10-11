# Settleva

Settleva is developer infrastructure for policy-based, evidence-driven USDC settlement on Arc.

> Define what must be proven. Verify the evidence. Settle the payment.

## Product model

An application defines a condition for each payment. The SDK canonicalizes the policy and prepares a payment commitment. An authoritative evidence provider supplies proof; the backend verifies provider/version, payment context and claims, protects against replay, and signs a settlement attestation. The shared Settleva contract holds USDC and enforces release authorization, expiry and eligible refunds.

The four featured scenarios—gaming rewards, freelance milestones, conditional commerce and agentic task settlement—are different policies over the same payment infrastructure. They do not require separate Settleva contracts.

## Current verified scope

The repository contains the shared settlement contract, SDK preparation and transaction helpers, a Reclaim verification backend, persistent replay protection, and a website playground. The current production proof adapter is configured around GitHub deployment-status evidence. The other three scenario presets are illustrative simulations until their authoritative evidence adapters are implemented and validated.

The contract's release path uses a backend verification signer. It is **backend-attested settlement**, not trustless on-chain verification of external proofs.

## Repository

- `apps/web`: landing page, use-case modals, guided/developer playground and Reclaim API routes.
- `packages/sdk`: deterministic payment preparation, amount conversion, viem transaction-call builders and attestation hashing.
- `packages/conditions`: condition schema, canonicalization, hashing and exact-claim evaluation.
- `packages/providers`: evidence-provider adapters.
- `packages/verification`: verified-data binding and persistent replay protection.
- `contracts`: one shared Settleva contract and Foundry tests.
- `docs`: architecture, trust boundaries, provider integration and deployment notes.

## Playground

The website playground uses the repository's actual condition canonicalizer and evaluator against editable JSON policy/evidence examples. It supports guided and developer modes and reports policy/evidence errors. It is local simulation only: it does not verify a real provider proof, sign an attestation, connect a wallet or transfer USDC.

## Development

Requirements: Node.js 22+, pnpm 10.15.0, and Foundry for Solidity tests.

```sh
pnpm install
pnpm check
pnpm test
pnpm build
cd contracts && forge test -vvv
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ARCHITECTURE_LOCK.md](docs/ARCHITECTURE_LOCK.md), [packages/sdk/README.md](packages/sdk/README.md), and [contracts/README.md](contracts/README.md).

## Security and production gates

The browser is not a trust authority. Never place provider credentials, database credentials, private keys or backend signing keys in public environment variables. Never treat arbitrary API JSON, client-supplied booleans or simulated evidence as proof.

Before issuing a settlement attestation, the backend must verify the Reclaim proof against the pinned provider/version, bind it to the initiated session and payment context, evaluate verified extracted claims, and confirm the live Arc contract contains a funded payment whose condition hash, provider hash and expiry match the requested policy. Database/RPC/configuration failures fail closed.

Mainnet readiness additionally requires secure production configuration, review of the contract's immutable verification signer, a deployed backend/database, and a controlled end-to-end settlement transaction. A passing CI run or successful playground simulation is not proof of production settlement.
