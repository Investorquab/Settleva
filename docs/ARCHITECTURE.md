# Settleva Architecture

## Core invariant

A payment may settle only when the evidence satisfies the exact condition committed when that payment was funded, the backend's verification rules pass, and the contract accepts the payment-bound settlement attestation.

## Components

1. **Application:** owns product-specific UI, identity and business workflow.
2. **SDK:** validates payment inputs and deterministically prepares the payment ID, condition hash, provider hash and proof context.
3. **Condition engine:** canonicalizes versioned policy data and evaluates verified claims deterministically. The initial operator set is intentionally limited to exact equality.
4. **Evidence provider:** obtains claims from a source authoritative for that use case. A successful API response is not automatically a cryptographic proof.
5. **Verification backend:** verifies provider/version and proof data, binds verified context to the payment and condition, enforces persistent replay protection, and signs a settlement attestation.
6. **Settleva contract on Arc:** a shared contract records each payment, locks the specified ERC-20 token, verifies signed release authorization, enforces expiry/refund rules, and prevents proof replay.

## Flow

Application -> SDK prepares immutable condition/payment commitment -> contract locks USDC -> evidence provider returns proof -> backend verifies proof and condition -> backend signs a payment-bound attestation -> payee submits release -> contract validates the attestation and payment state.

The web playground is separate from the production settlement path. It uses the repository's actual condition canonicalizer and evaluator on example inputs. It is not a proof verifier and does not submit transactions.

## Shared contract and use cases

Gaming, freelance milestone, conditional commerce and agentic task payments use the same Settleva contract. Each payment has its own ID, token, amount, expiry, condition hash and provider hash. Different use cases require different trusted evidence adapters and policies, not one contract deployment apiece. USDC itself is an existing token contract and is not deployed by Settleva.

## Trust boundaries

- Frontend input is untrusted and has no settlement authority.
- Payer/payee-submitted JSON does not establish that a real-world event occurred.
- Provider identity/version, verified claims and context must match the committed payment and condition.
- Replay/session mappings require persistent storage and atomic conflict handling.
- Signing credentials and provider credentials remain server-side.
- The current settlement contract trusts the configured backend verification signer. It does not directly verify a Reclaim proof on-chain.
- Refund eligibility is determined by contract state and expiry, not by the website's simulated state.

## Developer experience

The public landing page explains the flow and use cases. Use-case cards open detail modals that can preselect a scenario in the policy playground. The playground supports guided mode and editable JSON policy/evidence inputs. It shows parse/schema/evaluation failures and never claims to have moved real funds.

## Production readiness boundaries

A successful policy simulation is not sufficient for production. Mainnet release requires a reviewed contract, a verified signer configuration, a deployed and secured backend, a working authoritative provider, database/replay protection, and a tested end-to-end transaction against the deployed contract.
