# Architecture Lock — Settleva

**Status:** Current implementation contract. This file supersedes the earlier working draft that described SHA-256 condition hashes and a preferred on-chain Reclaim verifier. Those statements are not the deployed design.

## 1. Product and deployment model

Settleva is developer infrastructure for policy-based conditional USDC settlement on Arc. Deploy **one shared `Settleva.sol` contract**. Each payment stores its own payer, payee, token, amount, expiry, condition hash, provider hash, and status. Gaming rewards, freelance milestones, conditional commerce, and agentic task settlement are different policy/application workflows over that same contract; they are not separate contracts.

The contract is not a payment dashboard, and the playground is not a deployment wizard. Playground results are local simulations only.

## 2. Canonical commitments

- A version-1.0 condition contains a provider ID, provider version, expiry, and one or more unique-field claims.
- The only currently supported policy operator is exact string equality (`equals`).
- Claims are sorted deterministically by field, operator, then value; the condition is canonical JSON with the stable fields `version`, `provider`, `providerVersion`, `claims`, and `expiresAt`.
- The condition commitment is EVM-native `keccak256(UTF-8(canonical JSON))`, implemented by the shared conditions package. It is **not SHA-256**.
- The payment ID is a deterministic keccak256 commitment to normalized payer/payee/token addresses, normalized human token amount, expiry, and canonical condition.
- Payment expiry must equal `condition.expiresAt`. The client, SDK, backend, and funded on-chain record must agree on the exact condition hash, provider hash, and expiry.

## 3. Payment lifecycle and contract

The contract supports these effective states:

- `None -> Funded`: payer approves the token and calls `createPayment`; the contract pulls the exact amount.
- `Funded -> Released`: the payee calls `release` before expiry with a valid payment-bound verifier attestation and an unused proof identifier.
- `Funded -> Refunded`: the payer calls `refund` at or after expiry.

Released and refunded payments are terminal. The contract rejects invalid callers, duplicate payment IDs, invalid amounts/expiry, invalid signatures, reused proof identifiers, incorrect state, and failed ERC-20 transfers. USDC is an existing token and is not deployed by Settleva.

## 4. Verification trust boundary

The current model is **backend-attested settlement**, not trustless on-chain verification of Reclaim proofs:

1. The backend resolves the pinned Reclaim provider/version and cryptographically verifies the received proof.
2. It binds the proof to the initiated session, payment ID, condition hash, and provider context.
3. It evaluates verified extracted claims against the exact committed condition and enforces persistent replay protection.
4. It checks the Arc payment record is funded and its commitment matches the requested condition.
5. It signs an attestation bound to chain ID, deployed contract address, payment ID, condition hash, provider hash, and proof identifier.
6. The contract verifies the immutable `verificationSigner` and enforces payment state, payee authority, expiry, and proof reuse.

The contract trusts the configured backend verification signer. A compromised signer key could authorize invalid releases. The signer is immutable in the deployed contract, so changing it requires a new deployment. Use a dedicated signer, keep its key server-side, and verify its on-chain address before accepting funds.

## 5. Evidence and supported scope

The currently implemented live-provider path is a Reclaim-backed GitHub deployment-status proof. Its exact **published provider ID and version must be supplied and validated at runtime**; placeholders or static/unbound API responses are not acceptable.

The gaming, freelance, commerce, and agentic examples are illustrative simulations unless a source-specific authoritative proof adapter has been implemented and validated. A successful API response, client JSON, browser boolean, or playground result is not proof. The generic GitHub/HTTP provider classes fail closed until a real verifier path is configured.

## 6. Secrets and runtime configuration

- Never expose provider secrets, database credentials, deployment keys, or the verifier private key in the browser, public variables, repository, logs, or chat.
- Keep `SETTLEVA_VERIFIER_PRIVATE_KEY` server-side. The constructor's `verificationSigner` must equal the address derived from this private key.
- Use Arc mainnet chain ID `5042`, the Arc mainnet RPC, and the exact deployed contract address consistently in server and frontend configuration.
- Replay/session protection must use persistent database storage with atomic conflict handling.
- Backend configuration, RPC, database, provider, or on-chain-state errors fail closed: no settlement attestation is issued.
- SDK packages remain workspace/private until external package publication and dependency packaging are deliberately completed.

## 7. Locked UI and playground behavior

The landing page and visual system are locked. Do not alter `apps/web/app/page.tsx`, `apps/web/app/globals.css`, or `apps/web/app/layout.tsx` without explicit approval.

The playground must use the shared condition canonicalizer and evaluator, allow guided and developer modes, and clearly label all results as simulated. It must not deploy contracts, claim cryptographic proof verification, connect a wallet, or imply that USDC moved.

## 8. Mainnet release gate

A green CI run is code/test evidence, not a production deployment. Before accepting real funds, all of the following must be true:

1. The shared contract is deployed to Arc mainnet and its bytecode and immutable signer are checked.
2. The production backend/database and website are deployed with the exact server-side configuration.
3. A real published Reclaim provider ID/version is resolved by the SDK and matches server and client configuration.
4. The repository's mainnet preflight command passes against the actual Arc RPC, USDC contract, Settleva contract, verifier key, Reclaim configuration, and database.
5. A controlled low-value real payment completes funding -> real Reclaim proof -> backend verification/attestation -> payee release, with the final transaction and state confirmed on Arc.
6. A nonqualifying/invalid proof does not release funds, and expiry/refund behavior is verified before general launch.

Do not represent simulations, CI's “Record production deployment evidence” job, or a Vercel CI status as proof that the contract or backend has been deployed or that settlement is live.
