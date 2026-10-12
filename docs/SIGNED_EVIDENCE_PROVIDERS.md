# Signed Evidence Provider Integration

Settleva supports a second evidence path for use cases whose authoritative system can sign its own outcome event. It is separate from Reclaim. It allows a game server, marketplace workflow, order-management system, or agent execution service to integrate without pretending that a source-specific Reclaim provider already exists.

This is an integration protocol, not four pre-configured live integrations. Each source must own and protect its signing key, be authoritative for the outcome, be configured by exact provider ID and version, and pass a real Arc end-to-end acceptance test.

## Trust model

- The source system signs the exact event payload with Ed25519.
- Settleva verifies the signature against the public key registered for the exact provider ID and version.
- The request timestamp must be within five minutes of server time and may be at most 60 seconds in the future.
- Settleva checks that the signed event condition hash matches the included canonical condition, that all source claims exactly match the condition field set, and that the claims satisfy the condition.
- Settleva verifies that the actual Arc mainnet payment is funded, unexpired, and bound to the same condition and provider. It also checks that the server signer matches the deployed contract's immutable verification signer.
- PostgreSQL replay protection binds the signed event and proof identifier to that payment and condition. Only then does Settleva issue the ordinary payment-bound contract attestation.

The Settleva contract still uses backend-attested settlement. It does not independently verify source signatures on-chain. A compromised authoritative source key can assert false outcomes for that source; a compromised Settleva verifier key remains a critical release-authority risk. Integrators must disclose this trust model.

## Register a source

Configure SETTLEVA_SIGNED_EVIDENCE_ADAPTERS in the server-side environment as a JSON array. Register one exact provider ID/version and one Ed25519 public key for each source:

    [
      {
        "providerId": "settleva.gaming.match-result",
        "providerVersion": "1",
        "publicKeyPem": "-----BEGIN PUBLIC KEY-----\nREPLACE_WITH_REAL_BASE64_DER\n-----END PUBLIC KEY-----\n"
      },
      {
        "providerId": "settleva.freelance.milestone",
        "providerVersion": "1",
        "publicKeyPem": "-----BEGIN PUBLIC KEY-----\nREPLACE_WITH_REAL_BASE64_DER\n-----END PUBLIC KEY-----\n"
      },
      {
        "providerId": "settleva.commerce.delivery",
        "providerVersion": "1",
        "publicKeyPem": "-----BEGIN PUBLIC KEY-----\nREPLACE_WITH_REAL_BASE64_DER\n-----END PUBLIC KEY-----\n"
      },
      {
        "providerId": "settleva.agentic.task-completion",
        "providerVersion": "1",
        "publicKeyPem": "-----BEGIN PUBLIC KEY-----\nREPLACE_WITH_REAL_BASE64_DER\n-----END PUBLIC KEY-----\n"
      }
    ]

These provider identities are examples, not pre-registered providers. Replace every example with your source identity and real public key. These values must be public keys, never private keys. An exact provider ID/version cannot be registered twice. Publish a new version when the trusted outcome definition or key changes.

Generate an Ed25519 key pair inside the authoritative source's trusted server or secret manager. Export the public key as PEM and put only that public key into Settleva's server-side registry. Store the private key only in the source system's secret manager. Never put it in browser code, a public environment variable, a repository, or chat. Do not let an end-user or the agent whose completion is being evaluated be the authority that signs its own outcome.

## Request protocol

Send a server-to-server request to POST /api/evidence/attest with:

- Content-Type: application/json
- x-settleva-timestamp: Unix timestamp in seconds, as a ten-digit string
- x-settleva-signature: Ed25519 signature encoded as unpadded base64url

The signature message is the byte concatenation:

    UTF8("SETTLEVA-SIGNED-EVIDENCE-V1\n" + timestamp + "\n") || exactRawRequestBodyBytes

Sign the exact UTF-8 bytes sent as the HTTP body. Do not parse and reserialize JSON between signing and sending it. The endpoint limits requests to 64 KiB and rejects stale or future timestamps, altered bodies, unknown provider versions, duplicate/missing/unexpected claim fields, condition-hash mismatches, and invalid signatures.

The signed JSON body has this shape:

    {
      "protocolVersion": 1,
      "providerId": "settleva.gaming.match-result",
      "providerVersion": "1",
      "eventId": "match-123-final-result",
      "paymentId": "0x1111111111111111111111111111111111111111111111111111111111111111",
      "conditionHash": "DERIVE_THIS_WITH_THE_SETTLEVA_SDK",
      "condition": {
        "version": "1.0",
        "provider": "settleva.gaming.match-result",
        "providerVersion": "1",
        "claims": [
          { "field": "game.match.id", "operator": "equals", "value": "match-123" },
          { "field": "game.result.status", "operator": "equals", "value": "won" }
        ],
        "expiresAt": 1800003600
      },
      "claims": [
        { "field": "game.match.id", "value": "match-123" },
        { "field": "game.result.status", "value": "won" }
      ]
    }

The payment identifier, condition hash, and expiry above are illustrative. A real source must use the exact same policy committed when the payment was funded. It must independently verify the underlying outcome before signing, rather than accept a claim from a payer's browser.

A minimal Node.js signing sketch for the trusted source backend:

    import { sign } from "node:crypto";

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = Buffer.from(JSON.stringify(event), "utf8");
    const prefix = Buffer.from("SETTLEVA-SIGNED-EVIDENCE-V1\n" + timestamp + "\n", "utf8");
    const signature = sign(null, Buffer.concat([prefix, rawBody]), sourcePrivateKey).toString("base64url");

    await fetch(settlevaUrl + "/api/evidence/attest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-settleva-timestamp": timestamp,
        "x-settleva-signature": signature
      },
      body: rawBody
    });

The private key in this sketch exists only inside the authoritative source backend. The caller should retain the response's proofIdentifier and verificationSignature and allow the designated payee to submit the ordinary Settleva contract release transaction. The endpoint does not move tokens itself.

A successful response includes verified=true, the provider/version, payment and condition binding, proof identifier, configured verifier address, and contract-ready verification signature. It does not mean the release transaction has been submitted or confirmed. An exact same event binding is idempotent; conflicting reuse of an event ID is rejected.

## Integrating the four scenario families

Settleva chooses the applicable condition and source identity. A scenario label is not evidence.

| Scenario | Authoritative signer should be | Example policy claims |
| --- | --- | --- |
| Gaming rewards | The game's trusted match/achievement backend after it validates the final result | game.match.id, game.player.id, game.result.status |
| Freelance milestones | The marketplace's milestone/acceptance service or an independently controlled work-verification service | milestone.id, milestone.status, buyer.acceptance |
| Conditional commerce | The merchant order system or carrier/fulfillment service authoritative for the delivery condition | order.id, delivery.status, delivery.reference |
| Agentic economy | A trusted execution orchestrator that validates task completion and produces an immutable run identity/digest | task.id, task.status, execution.digest |

These are integration examples, not proof that the four sources are available or live. For each use case, select the actual source, establish who controls it, configure its server-side signing key, map its real event to the chosen condition fields, and test qualifying and non-qualifying events. Never let the payer, payee, frontend, or evaluated autonomous agent be the only authority for a disputed claim.

## Rollout checklist

1. Deploy the Settleva backend and run the existing PostgreSQL migration. This route reuses persistent replay storage and requires DATABASE_URL.
2. Configure Arc mainnet RPC, the deployed Settleva contract address, chain ID 5042, and a verifier private key whose derived address matches the contract's immutable verificationSigner.
3. Register one Ed25519 public key for each exact source provider ID/version in SETTLEVA_SIGNED_EVIDENCE_ADAPTERS.
4. Implement signing inside the authoritative source service. Restrict signing permissions, keep event audit trails, and issue a new provider version when its key or semantics change.
5. Ensure the application commits the exact same provider ID/version, condition fields and expiry. The payment must be funded and unexpired before this endpoint issues an attestation.
6. Test a valid event, an altered body, an invalid signature, a stale event, a mismatched condition, a failed claim, a duplicate event, and conflicting event reuse.
7. Confirm the attestation is accepted by the deployed contract only from the designated payee. Observe PaymentReleased on Arc and verify USDC balance movement. Separately test expiry refunds with another payment.
8. Configure distributed request-rate and concurrency limits at the trusted hosting edge and validate those limits under load. Signature verification and replay protection are not substitutes for ingress abuse controls.

Do not describe a use case as production-ready until its authoritative source integration has passed the live acceptance sequence. This protocol supplies the code boundary; it does not create source credentials, deploy the contract, configure hosting secrets, or independently prove that the source itself is honest.
