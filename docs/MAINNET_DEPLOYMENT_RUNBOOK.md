# Arc mainnet deployment runbook

This runbook covers deployment and acceptance testing for an integrator-owned Settleva instance. Do not treat a green build, a valid HTTPS endpoint, or a successful preflight as proof that a source integration or real payment release works.

For the currently deployed demo's addresses and test transaction links, see [Deployment status](STATUS.md).

## Network and dependencies

- Arc chain ID: `5042`
- RPC: `https://rpc.mainnet.arc.io`
- Explorer: `https://explorer.arc.io`
- Canonical Arc USDC ERC-20 interface: `0x3600000000000000000000000000000000000000`, 6 decimals
- Arc native USDC for gas/value uses an 18-decimal representation.
- Required runtime: Node.js 22+, pnpm 10.15.0.
- Use [Circle's Arc Foundry](https://github.com/circlefin/arc-foundry) for Arc-specific Solidity build/test commands.

## 1. Validate a clean checkout

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

From `contracts/` in an environment with Arc Foundry installed:

```bash
FOUNDRY_PROFILE=arc arc-forge build --sizes
FOUNDRY_PROFILE=arc arc-forge test -vvv
```

Do not broadcast a deployment if these checks fail. A green CI result validates the revision it ran against; it does not deploy the website, API, database, or contract.

## 2. Deploy an integrator-owned contract

Choose a dedicated verifier key before deployment. Keep the deployer key and verifier key separate, and never send either through chat, source control, browser code, or a public environment variable.

The contract constructor takes the verifier address, and `verificationSigner` is immutable. A different verifier requires a replacement contract deployment. The deployment script checks the intended Arc network and signer configuration; review it before use.

Follow the dry-run and broadcast procedure in [contracts/README.md](../contracts/README.md). After broadcasting, record the transaction hash and contract address, and verify:

- the RPC chain ID is 5042;
- bytecode exists at the new address;
- `verificationSigner()` equals the address derived from the dedicated server verifier key;
- `ARC_USDC()` equals the canonical Arc USDC ERC-20 interface.

## 3. Configure the backend

Set these values in the server's secret/environment manager; do not commit the real values:

- `ARC_RPC_URL` and `NEXT_PUBLIC_ARC_RPC_URL`, using HTTPS;
- `SETTLEVA_CHAIN_ID=5042` and `NEXT_PUBLIC_ARC_CHAIN_ID=5042`;
- `SETTLEVA_CONTRACT_ADDRESS` and `NEXT_PUBLIC_SETTLEVA_ADDRESS`, matching the deployed contract;
- `SETTLEVA_VERIFIER_PRIVATE_KEY`, whose derived EVM address matches the contract's immutable verifier;
- `DATABASE_URL` for durable replay protection;
- `SETTLEVA_SIGNED_EVIDENCE_ADAPTERS` only after registering the public key of a real authoritative source signer.

Run the database migration from the repository root:

```bash
pnpm --filter @settleva/web db:migrate
```

Then run the read-only mainnet preflight:

```bash
pnpm --filter @settleva/web preflight:mainnet
```

The preflight checks server/frontend chain and contract configuration, RPC reachability, canonical USDC, deployed bytecode, immutable verifier match, and replay database readiness. It does not test the honesty or availability of an external source.

## 4. Connect an authoritative evidence source

The generic endpoint is `POST /api/evidence/attest`. Configure the exact provider ID/version and its Ed25519 **public** key in `SETTLEVA_SIGNED_EVIDENCE_ADAPTERS`. The associated private key must live in the trusted authoritative source service or its secret manager.

The source signs the exact raw request bytes with the protocol prefix and a fresh Unix-seconds timestamp. Settleva checks signature freshness, exact provider ID/version, condition hash, exact claim fields and values, and on-chain payment eligibility before issuing the attestation. The backend persists replay bindings.

A server-side script that polls an external API and signs its own assertion is an adapter, not a cryptographic signature from that external system. Label such a setup as a prototype integration unless the trust owner and deployment boundary are explicit. The one-off GitHub/Vercel status test described in [STATUS.md](STATUS.md) is not a reusable provider shipped in this repository.

See the full [Signed evidence provider guide](integrations/SIGNED_EVIDENCE_PROVIDERS.md) for request format and integration requirements.

## 5. End-to-end acceptance gate

Use small amounts and wallets you control. Before calling a deployment production-enabled:

1. Confirm payer gas balance and ERC-20 USDC balance. Remember native Arc gas and ERC-20 values use different decimal representations.
2. Approve the exact ERC-20 amount and create a payment with expiry exactly equal to the committed condition expiry.
3. Verify the `PaymentCreated` event and read the funded payment state back from Arc.
4. Obtain an outcome directly from the configured authoritative source; do not accept a browser-provided boolean or unverified claim.
5. Submit the signed envelope, verify the payment-bound attestation, and retain its proof identifier.
6. Simulate the release, then have the designated payee submit `release`.
7. Verify a successful transaction receipt, matching `PaymentReleased` event, final `Released` status, token balance change, and used-proof flag.
8. Prove invalid signature, altered-body, stale-event, nonqualifying-claim, mismatched-condition, duplicate-event, and conflicting replay cases do not issue a release-capable attestation.
9. Test expiry/refund on a separate payment.

A same-wallet payer/payee test can verify a state transition, but it does not exercise a normal independent payer/recipient workflow. Do not substitute a simulation or a successful HTTP response for on-chain evidence.

## 6. Operational controls

Before production use, assess rate limits and concurrency controls at the ingress edge, TLS and secret rotation, database backups and recovery, service health/log monitoring, incident response for compromised source/verifier keys, and the integrity of the actual source system. The backend-attested contract explicitly trusts its immutable verifier; disclose that trust model to integrators.
