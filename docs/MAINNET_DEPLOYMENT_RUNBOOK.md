# Arc Mainnet Deployment Runbook

This is the single operational source of truth for taking Settleva from the current repository state to a controlled Arc mainnet settlement. Complete it in order; do not treat a green CI status, Vercel status check, or playground simulation as a deployment.

## Current starting point

- Repository branch: `main`.
- Shared Solidity implementation: `contracts/src/Settleva.sol`.
- Chain: Arc mainnet, ID `5042`.
- Arc RPC: `https://rpc.mainnet.arc.io`.
- Arc USDC: `0x3600000000000000000000000000000000000000`, six decimals.
- Release authorizer: immutable `verificationSigner` set by the contract constructor.
- Current proof scope: a real, published and pinned Reclaim GitHub deployment-status provider is required. Do not use placeholder IDs or a static/unbound proof.
- Gaming, freelance, commerce and agentic examples remain playground simulations until source-specific evidence adapters have been implemented and validated.

## 1. Pull and validate the code locally

Run from PowerShell:

```powershell
Set-Location C:\Users\NEW\Desktop\Settleva
git pull --ff-only origin main
pnpm install
pnpm check
pnpm test
pnpm build
Set-Location contracts
forge test -vvv
Set-Location ..
```

Do not proceed if a command fails. The CI “Record production deployment evidence” job only records a deployment-type CI artifact; it does **not** deploy the website, backend or contract.

## 2. Create and custody the verifier key

Use a dedicated signer key that is not your deployer key and is not used for normal wallet funds. Generate it with a trusted wallet tool on a secure device. Record its address as `VERIFICATION_SIGNER` for deployment, and make the corresponding private key available only as the server-side `SETTLEVA_VERIFIER_PRIVATE_KEY` secret.

The deployed contract's signer is immutable. If you lose the key or need to rotate it, the current contract cannot be updated to use a new signer; a replacement contract and migration plan are required. Never commit keys, put them in `NEXT_PUBLIC_*` variables, or send them in chat.

Before broadcasting the deployment, compare the address derived from the server-side verifier key to `VERIFICATION_SIGNER`. They must be identical.

## 3. Confirm Reclaim provider readiness

In Reclaim DevTools, confirm that the provider is **published**, the exact provider ID/version is available to the configured app credentials, the proof is dynamically tied to the intended GitHub deployment-status event, and the resulting claims contain the exact fields expected by the Settleva condition. A public/static response, a draft provider, or a proof whose context is not bound to the initiated payment is not sufficient.

Set all four variables to real matching values on the server and browser configuration:

- `RECLAIM_PROVIDER_ID`
- `RECLAIM_PROVIDER_VERSION`
- `NEXT_PUBLIC_RECLAIM_PROVIDER_ID`
- `NEXT_PUBLIC_RECLAIM_PROVIDER_VERSION`

The mainnet preflight resolves the configured ID/version through the Reclaim SDK and fails if it does not match. If Reclaim has not issued a working published provider ID/version, stop here: the production proof path is not ready.

## 4. Deploy exactly one shared Settleva contract

Set the deployment RPC and keys in the terminal environment or your secure secret manager. Avoid literal private-key assignments in commands that are saved to shell history.

From PowerShell:

```powershell
Set-Location C:\Users\NEW\Desktop\Settleva\contracts
$env:ARC_RPC_URL = "https://rpc.mainnet.arc.io"
$env:VERIFICATION_SIGNER = "0xYOUR_VERIFIER_SIGNER_ADDRESS"
# Set DEPLOYER_PRIVATE_KEY securely in the terminal environment; do not commit it.
forge script script/Deploy.s.sol:DeploySettleva --rpc-url $env:ARC_RPC_URL --broadcast -vvvv
```

The deploy script refuses to broadcast unless the connected chain reports ID `5042`. Save the resulting deployment transaction hash and deployed contract address from the Foundry output. Do not deploy a separate contract per use case.

Verify the result before configuring the app:

```powershell
cast chain-id --rpc-url $env:ARC_RPC_URL
cast code 0xYOUR_DEPLOYED_SETTLEVA_ADDRESS --rpc-url $env:ARC_RPC_URL
cast call 0xYOUR_DEPLOYED_SETTLEVA_ADDRESS "verificationSigner()(address)" --rpc-url $env:ARC_RPC_URL
```

Confirm bytecode exists and the returned signer equals the address derived from `SETTLEVA_VERIFIER_PRIVATE_KEY`. Record the deployment address/transaction in the team's deployment notes.

## 5. Configure and deploy the web/backend environment

Set production variables in the hosting provider's **server-side** environment settings. Use `apps/web/.env.example` as the variable inventory, but replace every template value. The local preflight command reads an optional untracked `apps/web/.env.production`; this file must never be committed.

Required configuration includes:

- Arc: `ARC_RPC_URL`, `SETTLEVA_CHAIN_ID=5042`, `SETTLEVA_CONTRACT_ADDRESS`, `NEXT_PUBLIC_ARC_RPC_URL`, `NEXT_PUBLIC_ARC_CHAIN_ID=5042`, and matching `NEXT_PUBLIC_SETTLEVA_ADDRESS`.
- Signing: `SETTLEVA_VERIFIER_PRIVATE_KEY` whose derived address matches the immutable on-chain signer.
- Reclaim: app ID/secret and the exact published provider ID/version, with public ID/version values matching.
- Replay protection: a reachable production Postgres `DATABASE_URL`.
- Callback: `RECLAIM_CALLBACK_URL=https://YOUR_DEPLOYED_DOMAIN/api/reclaim/callback`.

Deploy the backend and website, configure the production callback URL, and confirm the deployed service has the same values. A local env file is useful for preflight but does not configure Vercel or any other host.

## 6. Run the machine-checkable mainnet preflight

From the repository root in PowerShell, create `apps/web/.env.production` from `apps/web/.env.example` and fill it securely, or inject the same variables through your terminal/secret manager. Then run:

```powershell
Set-Location C:\Users\NEW\Desktop\Settleva
pnpm --filter @settleva/web preflight:mainnet
```

The preflight is read-only against Arc and Reclaim and performs a harmless `SELECT 1` database probe. It checks:

- required env variables have no template values;
- both RPCs report chain ID 5042;
- browser/server chain IDs and contract addresses agree;
- Arc USDC bytecode exists and reports six decimals;
- the deployed Settleva contract has bytecode;
- the server verifier key matches the contract's immutable `verificationSigner`;
- the Reclaim SDK resolves the exact configured provider ID/version;
- the replay/session database accepts a query; and
- the callback is HTTPS and points at `/api/reclaim/callback`.

Do not launch if any check fails. This preflight validates configuration and infrastructure; it cannot substitute for a real proof or real token transfer.

## 7. Controlled real-funds acceptance test

Only after the preceding gates pass:

1. Use a dedicated payer and payee wallet, and a minimal amount of Arc USDC.
2. Approve the deployed Settleva contract for exactly the test amount, then create a payment whose expiry matches `condition.expiresAt` and whose commitment matches the intended policy.
3. Confirm the funded payment record on Arc before starting the proof session.
4. Obtain a fresh, genuine Reclaim proof through the deployed callback flow.
5. Verify the backend accepts only the exact published provider/version and payment-bound context, evaluates the verified claims, and creates one attestation.
6. Have the payee submit `release`; confirm the Arc receipt, `PaymentReleased` event, payee balance change and terminal `Released` state.
7. Repeat with a nonqualifying or mismatched proof; no attestation/release should occur.
8. Verify expiry and payer refund behavior on a separate test payment. Do not use the same payment for both settlement and refund checks.

Keep transaction hashes, contract address, chain ID, test evidence and observed outcomes. If the real proof-to-release path cannot complete, stop; do not market the product as live conditional settlement.

## Launch boundary

The contract can support all four policy families through one shared deployment, but only a scenario with a validated authoritative evidence adapter may be described as production-enabled. The current playground does not move USDC. A passing preflight is necessary, not sufficient, and does not itself perform a deployment.
