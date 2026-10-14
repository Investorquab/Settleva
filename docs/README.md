# Documentation index

Use this index as the canonical map of Settleva documentation. Current deployed facts live in [Status and deployment evidence](STATUS.md); conceptual architecture and trust boundaries live in [Architecture](ARCHITECTURE.md).

## Start here

| Document | Purpose |
|---|---|
| [Project README](../README.md) | Product summary, live links, verified scope, quickstart |
| [Status and deployment evidence](STATUS.md) | Deployed addresses, verified transaction links, actual test scope, remaining gaps |
| [Architecture](ARCHITECTURE.md) | Components, payment lifecycle, condition commitments, trust boundary |
| [Mainnet deployment runbook](MAINNET_DEPLOYMENT_RUNBOOK.md) | How to deploy and validate an integrator-owned instance |
| [Security model](SECURITY_MODEL.md) | Key ownership, attack boundaries, protections, limitations |
| [Signed evidence integration guide](integrations/SIGNED_EVIDENCE_PROVIDERS.md) | Provider registry, request protocol, signature rules, integration requirements |
| [Roadmap and open gaps](ROADMAP.md) | Follow-up work without confusing it with shipped functionality |

## Repository and historical material

- [Contracts guide](../contracts/README.md) — Solidity interface, deployment model, Arc-specific details.
- [SDK guide](../packages/sdk/README.md) and [conditions package guide](../packages/conditions/README.md) — published packages and integration examples.
- [Deferred Reclaim experiment](../future-integrations/reclaim/README.md) — archived exploration and snapshots; not imported by the current V1 runtime.
- [Security reporting policy](../SECURITY.md) — how to report a vulnerability privately.
- [Agent guidance](../AGENTS.md) — repository-wide rules for coding agents; [Claude Code](../CLAUDE.md) reads the same canonical instructions.

## Status vocabulary

- **Implemented:** code exists in the repository and is covered by relevant tests.
- **Verified on-chain:** a transaction or state was checked against Arc mainnet.
- **Demonstration-only:** example/sample data is evaluated locally; no real source or payment is connected.
- **Prototype integration:** exercised with a test adapter, but not yet shipped as a reusable and independently operated provider.
- **Production integration:** the actual authoritative source has been connected and has passed valid, invalid, stale, replay, and end-to-end release acceptance tests.

These terms are deliberately distinct. Do not use a green build or a passing preflight as a synonym for production readiness.
