# Settleva Documentation Index

This index distinguishes V1 product documentation from deferred integration experiments.

## Start here

| Document | Purpose | Status |
| --- | --- | --- |
| [Project README](../README.md) | Product definition, repository map and current verified scope | Current |
| [Architecture](ARCHITECTURE.md) | SDK, condition, verifier and contract responsibilities | Current |
| [Architecture Lock](ARCHITECTURE_LOCK.md) | Binding product decisions and security boundaries | Normative |
| [Arc Readiness Audit](ARC_READINESS_AUDIT.md) | Arc-specific checks and deployment readiness | Readiness snapshot, not deployment evidence |
| [Mainnet Deployment Runbook](MAINNET_DEPLOYMENT_RUNBOOK.md) | Arc contract/backend deployment and acceptance gates | Operational guide; follow current architecture |
| [Security Review](SECURITY_AUDIT.md) | Scoped static security review and known gaps | Not a third-party penetration test |
| [Signed Evidence Provider Integration](integrations/SIGNED_EVIDENCE_PROVIDERS.md) | Server-to-server signed-source integration boundary | Protocol only; not four ready-made providers |
| [Contracts README](../contracts/README.md) | Contract lifecycle, verifier and deployment trust boundary | Current |
| [SDK README](../packages/sdk/README.md) | Installation path, payment example and package publishing | Publication must be verified |
| [Future Integrations: Reclaim](../future-integrations/reclaim/README.md) | Existing Reclaim/GitHub provider exploration, source snapshots and remaining work | Deferred; not required by V1 |
| [Future Ideas](planning/FUTURE_IDEAS.md) | Ideas explicitly outside the locked implementation scope | Planning only |

## Product boundaries

- The website playground is local simulation only.
- The current supported condition operator is exact equality (equals).
- Every integrator may operate its own contract instance and verifier. Do not represent the Settleva demo signer as mandatory for external users.
- A new payment gets its own condition at creation. Existing funded-payment terms are not editable in place.
- Green CI or a deployed website does not demonstrate that a real Arc USDC settlement has succeeded.

## Production status terminology

- Implemented: code exists with relevant tests.
- CI green: repository checks/tests/build and Arc Foundry tests passed; this is not deployment evidence.
- Configured: real production resources and secrets are present and checked.
- Source validated: the authoritative source, proof semantics and negative cases have been tested.
- Production-enabled: an actual Arc payment completed funding, source verification, attestation and release, with balances/transactions confirmed; negative/replay and refund behavior also passed.

Never promote a simulated scenario to production-enabled based on a policy match alone.
