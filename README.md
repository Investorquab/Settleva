# Settleva

Settleva is developer infrastructure for policy-based, evidence-driven USDC settlement on Arc.

> Define what must be proven. Verify the evidence. Settle the payment.

## Product model

Applications define a condition for each payment. The SDK canonicalizes that condition and prepares the payment commitment. Evidence providers supply claims; the backend verifies the provider proof, condition and payment context, protects against replay, and produces a settlement attestation. The shared Settleva contract locks USDC and enforces release authorization, expiry and eligible refunds.

The four featured scenarios—gaming rewards, freelance milestones, conditional commerce and agentic task settlement—are different policies and evidence adapters over the same payment infrastructure. They do not require separate Settleva contracts.

## Repository

- `apps/web`: landing page, use-case modals and interactive policy playground.
- `packages/sdk`: payment preparation and deterministic commitment helpers.
- `packages/conditions`: condition types, canonicalization, hashing and evaluation.
- `packages/providers`: evidence-provider adapters.
- `packages/verification`: verified data and persistent replay protection.
- `contracts`: shared USDC settlement contract and Foundry tests.
- `docs`: architecture, trust boundaries and provider integration notes.

## Playground

The website includes a guided mode and an editable developer mode. The playground uses the repository's real condition canonicalizer and evaluator against example JSON policy/evidence claims. It is a local simulation: it does not verify external provider proofs, sign settlement attestations, connect a wallet or transfer USDC.

A passing playground result means only that the sample claims satisfy the configured condition. Production settlement still requires an authoritative evidence adapter, backend verification and the contract's settlement authorization.

## Development

Requirements: Node.js 22+, pnpm 10.15.0, and Foundry for contract tests.

```sh
pnpm install
pnpm check
pnpm test
pnpm build
cd contracts && forge test -vvv
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/ARCHITECTURE_LOCK.md](docs/ARCHITECTURE_LOCK.md), and [packages/sdk/README.md](packages/sdk/README.md).

## Security

The browser is not a trust authority. Never place Reclaim secrets, database credentials, private keys or backend signing keys in public environment variables. Do not treat arbitrary API JSON, client-supplied booleans or simulated evidence as proof. Verify the provider identity/version, payment/condition binding and replay rules before issuing settlement authorization.

The current contract release path uses a backend verification signer. This trust boundary is explicitly documented; the design does not claim trustless on-chain verification of external proofs.
