# Repository instructions for coding agents

Read [README.md](README.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/STATUS.md](docs/STATUS.md), and [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md) before making substantial changes.

## Product boundaries

- Settleva is developer infrastructure: SDK + condition engine + reusable settlement contract + verification integration boundary. The website is a demo/onboarding surface, not a hosted multi-tenant escrow dashboard.
- The four homepage scenarios are local policy simulations using sample evidence. Do not connect them to real money or describe them as live integrations without an explicit scope change and verified source integration.
- Preserve one canonical Solidity implementation under `contracts/`.
- The currently deployed contract's `verificationSigner` is immutable. Changing it requires a replacement deployment.
- The backend issues a payment-bound attestation; it does not submit the release transaction.

## Security rules

- Never add keys, seed phrases, provider private keys, database passwords, live `.env` files, or server-generated secrets to source control.
- Never expose server-side secrets through `NEXT_PUBLIC_*`, browser code, example payloads, logs, or documentation.
- Keep the deployer, Settleva verifier, and authoritative source signer separate.
- Do not describe the VPS-only GitHub-status test adapter as a GitHub-signed event or a reusable provider connector. See [Deployment status](docs/STATUS.md).
- Treat smart-contract, payment-commitment, verifier, replay-protection, and UI trust-boundary changes as security-sensitive.

## Development checks

Use the locked package manager and dependencies:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

For Solidity changes, use Circle's Arc Foundry and run the contract build and test suite described in [contracts/README.md](contracts/README.md).

Before changing code, inspect existing implementation and tests, make the smallest safe change, and run relevant checks. Do not silently redesign the existing website, change the four demo scenarios' labels/scope, broadcast mainnet transactions, alter deployments, or modify server configuration as part of ordinary code changes.

## Documentation rules

- Keep `README.md` concise and current; put operational detail in the canonical `docs/` guides.
- Use [docs/README.md](docs/README.md) as the documentation index.
- Clearly distinguish implemented behavior, simulated examples, test-only adapters, and production-ready integrations.
- Update [docs/STATUS.md](docs/STATUS.md) when a deployed address, verification result, or acceptance-test state changes.
- Preserve the Reclaim experiment as explicitly deferred historical material unless the product scope changes.
