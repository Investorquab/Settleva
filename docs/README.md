# Settleva Documentation Index

This page is the navigation and visibility guide for the repository's documentation.

## Public by design

The Settleva repository is public. Every tracked Markdown file is therefore publicly readable regardless of its folder name. Moving a document into a folder named internal, operations, or security does **not** make it private. Treat this index and every linked document as publishable material.

Never commit actual environment files, API credentials, Reclaim app secrets, database URLs or passwords, deployer/verifier private keys, source-system signing private keys, access tokens, or hosting-provider credentials. Keep those in a secret manager or untracked local environment file. Public keys and deployed contract addresses are not private credentials, though deployment details should only be documented after they are verified. Confidential incident-response notes or customer-specific operational material belong in a separate private system.

## Start here

| Document | Audience and purpose | Status / boundary |
| --- | --- | --- |
| [Project README](../README.md) | Public product overview, verified scope, development commands and top-level safety boundary | Read this first; the homepage playground is simulation-only |
| [Architecture](ARCHITECTURE.md) | Engineers integrating the SDK, conditions, evidence and shared contract | Describes the system; does not imply a provider is live |
| [Architecture Lock](ARCHITECTURE_LOCK.md) | Normative implementation/product invariants and protected UI rules | Keep separate from the explanatory architecture guide |
| [Arc Readiness Audit](ARC_READINESS_AUDIT.md) | Arc mainnet assumptions, CI state and open launch gates | Dated readiness snapshot; not deployment evidence |
| [Mainnet Deployment Runbook](MAINNET_DEPLOYMENT_RUNBOOK.md) | Operator sequence for contract, backend, database, provider and acceptance-test deployment | Public operational guide with placeholders only; never put actual secrets here |
| [Security Review](SECURITY_AUDIT.md) | Static application-security review and operational gates | Not a third-party penetration test; the new signed-evidence path needs its own focused review |
| [Signed Evidence Provider Integration](integrations/SIGNED_EVIDENCE_PROVIDERS.md) | Server-to-server Ed25519 source integration protocol | Protocol and tests exist; source systems still have to be connected and trusted |
| [GitHub Deployment Reclaim Provider](reclaim/GITHUB_DEPLOYMENT_STATUS_PROVIDER.md) | Canonical field mapping, Reclaim request requirements and acceptance tests | Does not claim the provider is published or validated |
| [Replay Protection](reclaim/REPLAY_PROTECTION.md) | Persistent replay/session storage, transaction safety and ingress controls | Configure operational edge limits before exposing endpoints |
| [Contracts README](../contracts/README.md) | Solidity trust boundary, Arc asset and contract deployment instructions | One shared contract; verifier key is immutable after deployment |
| [SDK README](../packages/sdk/README.md) | Payment preparation and transaction-call examples | SDK is currently workspace-private, not independently published on npm |
| [Future Ideas](planning/FUTURE_IDEAS.md) | Items explicitly outside the locked implementation scope | Planning note only; not implementation authorization |

## How the documents fit together

- `ARCHITECTURE.md` explains the system and its data flow. `ARCHITECTURE_LOCK.md` records binding invariants and constraints future changes must preserve; these documents are complementary, not duplicates.
- `ARC_READINESS_AUDIT.md` records Arc compatibility and launch readiness. `SECURITY_AUDIT.md` is a scoped static security review with its own baseline. They should not be merged because they answer different questions.
- The two GitHub/Reclaim provider specifications overlapped. Their detailed material is consolidated in [GITHUB_DEPLOYMENT_STATUS_PROVIDER.md](reclaim/GITHUB_DEPLOYMENT_STATUS_PROVIDER.md); [SETTLEVA_PROVIDER_SPEC.md](reclaim/SETTLEVA_PROVIDER_SPEC.md) remains as a compatibility pointer so existing links work.
- The signed-evidence guide lives under `docs/integrations/`. Its previous `docs/SIGNED_EVIDENCE_PROVIDERS.md` path is retained as a pointer.
- The future-ideas note lives under `docs/planning/`. Its previous root path remains as a pointer.
- `contracts/README.md` and `packages/sdk/README.md` stay beside their packages so developers find local instructions in the relevant directory.

## Production status terminology

Use the terms precisely:

- **Code implemented:** code exists in the repository and has relevant tests.
- **CI green:** repository checks/tests/build and Arc Foundry tests passed. This does not deploy anything.
- **Configured:** real production resources/secrets are set at the host and have been checked.
- **Source validated:** the exact authoritative provider/version or source-signed system has passed positive and negative evidence tests.
- **Production-enabled:** a real low-value Arc payment has completed funding, evidence validation, attestation, payee release and balance confirmation; invalid/replayed evidence and expiry refunds have also been tested.

As of the source baseline linked in the project README, CI is green, but CI alone does not establish a verified live contract deployment or a real source-to-settlement acceptance transaction. Do not describe all four use cases as production-ready merely because shared adapter mechanisms exist.

## Documentation maintenance rules

1. Update readiness and security documents with a date, commit baseline and precise review scope.
2. Separate verified facts from unverified external configuration and open launch gates.
3. Keep one canonical full specification for each integration; use compatibility pointers rather than parallel copies.
4. Never place real secrets or sensitive operational notes in this public repository.
5. Preserve the approved homepage/playground scope unless product-design authorization explicitly changes it.
