# Architecture

Settleva is developer infrastructure for conditional USDC settlement on Arc. The reusable contract and SDK are the product; the website is a policy playground and onboarding surface, not a hosted escrow dashboard.

## Core components

| Component | Responsibility |
|---|---|
| `packages/conditions` | Defines the payment-condition schema, canonical form, condition hash, and deterministic claim evaluation. Current policy operator support is `equals`. |
| `packages/sdk` | Normalizes payment inputs, prepares deterministic payment IDs and commitments, and builds viem calls for approval, payment creation, release, and refund. It does not hold keys or submit transactions by itself. |
| `contracts/src/Settleva.sol` | Escrows Arc USDC, binds each payment to payer, payee, amount, expiry, condition hash and provider hash, then releases with a verifier attestation or refunds after expiry. |
| `apps/web/app/page.tsx` + `apps/web/lib/playground-engine.ts` | Interactive local examples for gaming, freelance, commerce, and agentic policy shapes. They evaluate sample evidence locally and are not live integrations. |
| `apps/web/app/api/evidence/attest/route.ts` | Node.js endpoint that validates a registered source-key signature, exact condition, eligible on-chain payment, verifier configuration, and persistent replay record before returning an attestation. |
| `packages/verification` / PostgreSQL | Stores persistent provider-event/proof bindings to prevent conflicting reuse. |
| `packages/providers` | Provider integration utilities. A complete provider still needs its authoritative source, key management, field mapping, and acceptance tests. |

## Payment lifecycle

1. The integrating application prepares a payment with the SDK. Its condition includes a provider ID/version, exact claims, and expiry.
2. The payer approves the contract for the required USDC amount and calls `createPayment`. The contract stores the payment terms and emits `PaymentCreated`.
3. The authoritative source must verify the underlying outcome independently. Its source-side service sends an Ed25519-signed envelope to the integration's Settleva verification backend.
4. The backend checks the signature and freshness, canonical condition hash, exact provider ID/version, claim field set and values, funded on-chain payment, expiry, token, provider hash, immutable verifier address, and replay store.
5. The backend returns a payment-bound verifier attestation. It does not send a blockchain transaction.
6. The designated payee submits `release(paymentId, proofIdentifier, verificationSignature)`. The contract checks the signature, payment state, expiry, payee, and proof-reuse flag before transferring USDC.
7. If a funded payment reaches expiry without release, the payer can call `refund`.

```mermaid
sequenceDiagram
    participant App as Integrator application / SDK
    participant Payer as Payer wallet
    participant Chain as Settleva contract on Arc
    participant Source as Authoritative source
    participant API as Verification API + PostgreSQL
    participant Payee as Payee wallet

    App->>Payer: Request approval and create-payment calls
    Payer->>Chain: approve USDC; createPayment(...)
    Chain-->>App: PaymentCreated
    Source->>API: Signed event + timestamp
    API->>Chain: Read funded payment and committed terms
    API->>API: Verify Ed25519 signature, condition and replay state
    API-->>Source: Payment-bound attestation
    Payee->>Chain: release(paymentId, proofIdentifier, signature)
    Chain-->>Payee: PaymentReleased + USDC transfer
```

The source key and Settleva verifier key serve different trust roles. The source proves its outcome to the backend; the Settleva verifier attests that the outcome meets the funded payment condition. The contract does not independently verify arbitrary Web2 evidence.

## Payment commitments

Each payment stores its own payer, payee, token, amount, expiry, condition hash, provider hash, and status. A different payment can use different terms without redeploying the contract. Funded terms cannot currently be amended in place.

The current deployment supports only the canonical Arc USDC ERC-20 interface:

- Chain ID: `5042`
- ERC-20 address: `0x3600000000000000000000000000000000000000`
- ERC-20 amount precision: 6 decimals
- Arc native gas/value representation: 18 decimals

The contract's `verificationSigner` is immutable. Changing it for that deployment requires a replacement contract.

## Four playground scenarios

The homepage presents four shapes of policy to help developers understand the same underlying primitives:

- **Gaming rewards:** example match/result claims.
- **Freelance milestones:** example milestone and acceptance claims.
- **Conditional commerce:** example order/delivery claims.
- **Agentic economy:** example task-completion claims.

These flows use sample policies and evidence with the local condition engine. They do not connect an actual source, wallet, real payment, or release transaction. A scenario should be called a live integration only after its authoritative source is wired into the source-signed protocol and passes a real Arc acceptance test.

## Deployment model

Each integrator can deploy its own instance of the same contract implementation and choose its own verifier at deployment. The integrator is responsible for its source system, signer custody, application, RPC configuration, database, monitoring, ingress limits, and user wallet experience.

The current demo status and exact transaction evidence are maintained in [STATUS.md](STATUS.md). Deployment steps for a new instance are in [MAINNET_DEPLOYMENT_RUNBOOK.md](MAINNET_DEPLOYMENT_RUNBOOK.md). The older Reclaim experiment remains explicitly deferred under [future integrations](../future-integrations/reclaim/README.md).
