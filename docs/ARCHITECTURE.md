# Settleva Architecture

## Core product

Settleva is developer infrastructure for conditional USDC settlement on Arc. An application integrates the SDK and invokes a Settleva contract instance. The application owns product UI, user identity, wallet connection, business rules and its source-of-truth systems.

## Components

1. SDK: validates payment input, canonicalizes conditions, prepares deterministic payment commitments, converts token amounts and builds viem-compatible contract calls.
2. Condition engine: canonicalizes versioned policies and deterministically evaluates verified claims. The current operator is exact equality (equals).
3. Evidence integration: a source authoritative for the relevant outcome supplies verified claims or signs a source event. The integration must not rely on user-supplied browser values.
4. Integrator verification backend: validates source evidence, binds it to the funded payment and condition, enforces replay protection, then signs a settlement attestation.
5. Settleva contract: holds the specified Arc USDC ERC-20 amount, records each payment independently, validates the configured verifier's signature and enforces release/refund state.

## Deployment model

The repository contains one reusable Solidity implementation. An integrator can deploy its own instance and choose its own verificationSigner at construction. The signer is immutable for that instance; changing it requires a replacement instance. The integrator keeps its deployment key and verifier private key under its own control and never exposes them in browser code.

The SDK can be used from an existing application and is not tied to the Settleva website. The connected payer wallet signs user-authorized token approval/funding transactions. The SDK itself does not receive private keys, custody USDC or broadcast user transactions by default.

## Payment lifecycle

A developer chooses the payment's payee, amount, expiry and policy when creating the payment. Those values are committed to that payment, so a different new payment can use a different policy without redeploying the contract.

The current state machine is:

- None → Funded: the payer approves and creates the payment.
- Funded → Released: the designated payee submits a valid payment-bound attestation before expiry.
- Funded → Refunded: the payer requests a refund at or after expiry.

A funded payment cannot currently be amended in place. Support for amendment, cancellation or replacement before expiry would require explicit contract functionality and review.

## Evidence trust boundary

The contract trusts the verifier configured for its instance. Backend attestation is not trustless on-chain verification of Web2 evidence. A secure source integration must validate the actual outcome, tie it to the canonical condition and funded payment, prevent replay, and issue an attestation only after all checks pass. The contract remains responsible for enforcing on-chain authorization and the payment lifecycle.

The source-signed backend endpoint is an integration boundary rather than four complete connectors. Each game server, freelance platform, merchant/fulfilment system or agent orchestrator must provide an authoritative outcome and be wired and tested independently.

## Four website scenarios

Gaming rewards, freelance milestones, conditional commerce and agentic economy demonstrate different policies over the same settlement contract. The homepage playground evaluates sample policies against sample evidence locally. It is a simulation: it does not connect a wallet, prove a real external outcome, sign an attestation or transfer USDC.

## Deferred Reclaim work

Reclaim/GitHub deployment proof exploration is preserved in future-integrations/reclaim/. It is optional future integration work, not a base SDK dependency or requirement for the four scenario demonstrations.
