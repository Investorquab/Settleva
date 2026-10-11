# Arc Mainnet Deployment Runbook

This is the single operational source of truth for taking Settleva from the current repository state to a controlled Arc mainnet settlement. Complete it in order; do not treat a green CI status, Vercel status check, or playground simulation as a deployment.

## Current starting point

- Repository branch: `main`.
- Shared Solidity implementation: `contracts/src/Settleva.sol`.
- Chain: Arc mainnet, ID `5042`.
- RPC: `https://rpc.mainnet.arc.io`.
- Explorer: `https://explorer.arc.io`.
- Arc USDC ERC-20 interface: `0x3600000000000000000000000000000000000000`, six decimals.
- Arc native USDC for gas: 18 decimals. Do not reuse ERC-20 units for native-value amounts.
- Release authorizer: immutable `verificationSigner` set by the contract constructor.
- Asset: only Arc USDC ERC-20 `0x3600000000000000000000000000000000000000` (6 decimals). Arc native USDC for gas uses 18 decimals.
- Current proof scope: a real, published and pinned Reclaim GitHub deployment-status provider is required. Do not use placeholder IDs or a static/unbound proof.
- Gaming, freelance, commerce and agentic examples remain playground simulations until source-specific evidence adapters have been implemented and validated.

## 1. Pull and validate the code locally

In PowerShell, run the workspace checks:

```powershell
Set-Location C:\Users\NEW\Desktop\Settleva
git pull --ff-only origin main
pnpm install
pnpm check
pnpm test
pnpm build
```

For Solidity, use **Circle's Arc Foundry**, not the standard `foundryup` installation. Official instructions and signed/checksummed releases are at:

- https://github.com/circlefin/arc-foundry
- https://github.com/circlefin/arc-foundry/releases

Arc Foundry's official README explicitly warns against using the upstream `foundry-rs/foundry-toolchain` action to test Arc contracts because it executes with Ethereum rules. This repository's CI pins Arc Foundry and sets `FOUNDRY_PROFILE=arc`.

On Windows, open Ubuntu under WSL 2. The shared Windows folder appears under `/mnt/c`. For the x86-64 Ubuntu/WSL binary, Arc Foundry's documented release artifact is `arc-foundry-v0.8.0-2-x86_64-unknown-linux-gnu.tar.gz`. Verify its checksum before extracting, and put the extracted tools on PATH as `arc-forge`, `arc-cast`, and `arc-anvil`. Do not run `foundryup` as a substitute for Arc Foundry.

Inside the Ubuntu/WSL shell:

```bash
cd /mnt/c/Users/NEW/Desktop/Settleva/contracts
arc-forge --version
FOUNDRY_PROFILE=arc arc-forge install foundry-rs/forge-std
FOUNDRY_PROFILE=arc arc-forge build --sizes
FOUNDRY_PROFILE=arc arc-forge test -vvv
```

A green upstream Foundry run alone is not an Arc-compatibility result. Arc Foundry can also start a local Arc execution environment with `arc-anvil --network arc`; its default test accounts are public, must never hold real funds, and are only for development. See the official README for forking and hardfork options.

Do not proceed if workspace checks or Arc Foundry tests fail. The CI evidence record is metadata only; it does **not** deploy the website, backend or contract.

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

Set the deployment RPC and keys in the Ubuntu/WSL environment or your secure secret manager. Do not paste secrets into source control, a browser variable, or chat, and avoid literal private-key assignments in shell commands saved to history.

Inside WSL:

```bash
cd /mnt/c/Users/NEW/Desktop/Settleva/contracts
export ARC_RPC_URL="https://rpc.mainnet.arc.io"
read -rsp "Deployer private key: " DEPLOYER_PRIVATE_KEY; echo; export DEPLOYER_PRIVATE_KEY
read -rsp "Dedicated verifier private key: " SETTLEVA_VERIFIER_PRIVATE_KEY; echo; export SETTLEVA_VERIFIER_PRIVATE_KEY
export VERIFICATION_SIGNER="$(arc-cast wallet address --private-key "$SETTLEVA_VERIFIER_PRIVATE_KEY")"
printf "Verifier address: %s\\n" "$VERIFICATION_SIGNER"
FOUNDRY_PROFILE=arc arc-forge script script/Deploy.s.sol:DeploySettleva --rpc-url "$ARC_RPC_URL" --broadcast -vvvv
```

The deploy script refuses to broadcast unless the connected chain reports ID `5042`, checks `SETTLEVA_VERIFIER_PRIVATE_KEY` derives exactly `VERIFICATION_SIGNER`, and requires deployer/verifier keys to be different. Supply both securely in WSL or a secret manager, never in source control or chat. Save the deployment transaction hash and deployed contract address from the Arc Foundry output. Do not deploy a separate contract per use case.

Verify the result before configuring the app:

```bash
arc-cast chain-id --rpc-url "$ARC_RPC_URL"
arc-cast code 0xYOUR_DEPLOYED_SETTLEVA_ADDRESS --rpc-url "$ARC_RPC_URL"
arc-cast call 0xYOUR_DEPLOYED_SETTLEVA_ADDRESS "verificationSigner()(address)" --rpc-url "$ARC_RPC_URL"
```

Confirm bytecode exists and the returned signer equals the address derived from `SETTLEVA_VERIFIER_PRIVATE_KEY`. Record the deployment address and transaction in the deployment notes.

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

The preflight is read-only against Arc and Reclaim and performs a harmless `SELECT 1` database probe. First apply the schema with `pnpm --filter @settleva/web db:migrate` against the same production database. It checks:

- required env variables have no template values;
- both RPCs report chain ID 5042;
- browser/server chain IDs and contract addresses agree;
- Arc USDC bytecode exists and reports six ERC-20 decimals;
- the deployed Settleva contract has bytecode and `ARC_USDC()` returns the canonical Arc USDC address;
- the server verifier key matches the contract's immutable `verificationSigner`;
- the Reclaim SDK resolves the exact configured provider ID/version;
- the replay/session database accepts a query; and
- the callback is HTTPS and points at `/api/reclaim/callback`.

Do not launch if any check fails. This preflight validates configuration and infrastructure; it cannot substitute for a real proof or real token transfer.

## 7. Controlled real-funds acceptance test

Only after the preceding gates pass:

1. Use a dedicated payer and payee wallet, and a minimal amount of Arc USDC.
2. Ensure the payer has enough Arc native USDC to cover gas; native values use 18 decimals while ERC-20 amounts use six.
3. Approve the deployed Settleva contract for exactly the test amount, then create a payment whose expiry matches `condition.expiresAt` and whose commitment matches the intended policy.
4. Confirm the funded payment record on Arc before starting the proof session.
5. Obtain a fresh, genuine Reclaim proof through the deployed callback flow.
6. Verify the backend accepts only the exact published provider/version and payment-bound context, evaluates the verified claims, and creates one attestation.
7. Have the payee submit `release`; confirm the Arc receipt, `PaymentReleased` event, payee balance change and terminal `Released` state.
8. Repeat with a nonqualifying or mismatched proof; no attestation/release should occur.
9. Verify expiry and payer refund behavior on a separate test payment. Do not use the same payment for both settlement and refund checks.

Keep transaction hashes, contract address, chain ID, test evidence and observed outcomes. If the real proof-to-release path cannot complete, stop; do not market the product as live conditional settlement.

## Launch boundary

The contract can support all four policy families through one shared deployment, but only a scenario with a validated authoritative evidence adapter may be described as production-enabled. The current playground does not move USDC. A passing preflight is necessary, not sufficient, and does not itself perform a deployment.
