# Arc Mainnet Deployment Runbook

This runbook is for a controlled Settleva demo deployment and for integrators deploying their own instance. Do not treat a green CI run, a hosting status, or a playground simulation as a deployment or real settlement.

## Product and deployment model

- Settleva is developer infrastructure. The SDK and reusable Solidity implementation are the product.
- Keep one canonical Settleva.sol implementation in the repository.
- The demo uses its own deployment and verifier. External developers may deploy their own instance and select their own verification signer.
- A new payment has its own condition and payment fields; creating a new payment does not require redeployment. The current contract does not edit already-funded payment terms in place.
- The website playground is simulation-only. There is no separate live transaction page in the V1 product.
- Reclaim/GitHub proof is deferred under future-integrations/reclaim. The source-signed endpoint is a general server-to-server integration boundary, not four preconnected scenario integrations.

## Arc assumptions

- Chain ID: 5042.
- RPC: https://rpc.mainnet.arc.io.
- Explorer: https://explorer.arc.io.
- Arc USDC ERC-20 interface: 0x3600000000000000000000000000000000000000, six decimals.
- Native Arc USDC value/gas uses 18 decimals. ERC-20 escrow amounts use six.
- Use Circle's Arc Foundry, not upstream Foundry, for Arc-specific contract build and tests: https://github.com/circlefin/arc-foundry.

## 1. Validate code before deployment

From a clean checkout, run:

    pnpm install --frozen-lockfile
    pnpm check
    pnpm test
    pnpm build

Inside contracts/ in Ubuntu/WSL with Circle's Arc Foundry installed:

    FOUNDRY_PROFILE=arc arc-forge build --sizes
    FOUNDRY_PROFILE=arc arc-forge test -vvv

Do not broadcast a deployment if any repository checks or Arc contract tests fail. CI validates the code revision it ran against; it does not deploy the website, database, backend or contract.

## 2. Deploy an integrator-owned instance

The current contract's verificationSigner is immutable. Select the demo verifier before deployment. Use a separate deployment wallet and verifier key. Do not send keys in chat or commit them to source control.

In WSL, from contracts/, prompt for the private keys without echoing them:

    export ARC_RPC_URL="https://rpc.mainnet.arc.io"
    read -rsp "Deployer private key: " DEPLOYER_PRIVATE_KEY; echo; export DEPLOYER_PRIVATE_KEY
    read -rsp "Dedicated verifier private key: " SETTLEVA_VERIFIER_PRIVATE_KEY; echo; export SETTLEVA_VERIFIER_PRIVATE_KEY
    export VERIFICATION_SIGNER="$(arc-cast wallet address --private-key "$SETTLEVA_VERIFIER_PRIVATE_KEY")"
    FOUNDRY_PROFILE=arc arc-forge script script/Deploy.s.sol:DeploySettleva --rpc-url "$ARC_RPC_URL" -vvvv

This is the dry run. Confirm chain ID 5042, contract constructor signer, and deployer gas balance. Only then repeat with --broadcast. Save the deployment transaction hash and contract address. The verifier private key belongs only in the server-side environment for that instance; the browser and SDK never need it.

Verify the deployed result:

    arc-cast chain-id --rpc-url "$ARC_RPC_URL"
    arc-cast code 0xYOUR_DEPLOYED_SETTLEVA_ADDRESS --rpc-url "$ARC_RPC_URL"
    arc-cast call 0xYOUR_DEPLOYED_SETTLEVA_ADDRESS "verificationSigner()(address)" --rpc-url "$ARC_RPC_URL"
    arc-cast call 0xYOUR_DEPLOYED_SETTLEVA_ADDRESS "ARC_USDC()(address)" --rpc-url "$ARC_RPC_URL"

The returned signer must match the address derived from the server verifier key, and ARC_USDC must match the canonical Arc USDC ERC-20 interface.

## 3. Configure the demo backend

Set server-side environment variables in the hosting provider or an untracked local apps/web/.env.production file. Use apps/web/.env.example as the inventory. Never expose server secrets through NEXT_PUBLIC variables.

Required settings include:

- ARC_RPC_URL and NEXT_PUBLIC_ARC_RPC_URL, both using HTTPS.
- SETTLEVA_CHAIN_ID=5042 and NEXT_PUBLIC_ARC_CHAIN_ID=5042.
- SETTLEVA_CONTRACT_ADDRESS and NEXT_PUBLIC_SETTLEVA_ADDRESS, matching the deployed instance.
- SETTLEVA_VERIFIER_PRIVATE_KEY, whose address must match the deployed immutable verificationSigner.
- DATABASE_URL for durable replay protection.
- SETTLEVA_SIGNED_EVIDENCE_ADAPTERS only when a real authoritative source backend is configured and its Ed25519 public key is registered.

Do not configure Reclaim variables for V1. The retired Reclaim API routes return a deferred response.

Apply the database migration:

    pnpm --filter @settleva/web db:migrate

Then run the read-only preflight:

    pnpm --filter @settleva/web preflight:mainnet

The preflight checks chain IDs, matching contract address configuration, Arc RPC connectivity, USDC bytecode and decimals, deployed contract bytecode and signer, and the provider-neutral evidence replay schema. Passing preflight is not evidence that an external source is connected or that a payment settled.

## 4. Connect a real source before claiming a live settlement

A production settlement requires an authoritative source that the integrator controls or explicitly trusts. The source must establish the real outcome, bind it to the condition committed when the payment was funded, resist replay and authorize only the exact settlement.

The generic source-signed endpoint at POST /api/evidence/attest accepts a source-server Ed25519 signature and issues the backend attestation after validating configuration, the condition and funded on-chain payment. It does not itself submit a release transaction, and it is not a preconfigured integration for gaming, freelance, commerce or agentic systems.

The four website scenarios remain sample policy simulations unless their actual authoritative sources are connected and tested. Do not treat browser-provided JSON, a successful HTTP response, a local playground match or an archived Reclaim proof flow as production evidence.

## 5. End-to-end acceptance gate

Only after deployment, configuration and source validation:

1. Use dedicated payer and payee wallets and a minimal amount of Arc USDC.
2. Confirm payer gas balance, remembering native values use 18 decimals and ERC-20 transfers use six.
3. Approve the deployed contract for the exact test amount and create a payment with expiry equal to the committed condition expiry.
4. Confirm the funded payment record on Arc.
5. Obtain a genuine outcome from the configured authoritative source and pass it through the trusted verifier backend.
6. Confirm that the verifier issues a payment-bound attestation only after source validation and replay protection.
7. Have the designated payee submit release; record the transaction hash, PaymentReleased event, terminal status and balance change.
8. Test nonqualifying evidence, invalid signatures, mismatched conditions and replay attempts; they must not release funds.
9. Separately test expiry and payer refund behavior on a different payment.

If the actual source-to-attestation-to-release sequence cannot complete, do not claim production-enabled conditional settlement. Keep the remaining scenarios labelled as simulations.

## Package release status

The public packages `@settleva/conditions@0.1.1` and `@settleva/sdk@0.1.1` are released. A clean consumer test installed `@settleva/sdk@0.1.1`, resolved the matching conditions dependency, and imported the SDK's payment-preparation and contract-call helpers successfully. Trusted Publisher staging was also exercised through GitHub Actions. Package distribution is no longer the deployment blocker.

## Current deployment gate

Do not broadcast a mainnet deployment until the clean-checkout repository checks and Arc Foundry tests pass and the following are ready:

1. A dedicated deployer wallet with enough Arc native USDC for gas.
2. A separate verifier private key, kept exclusively in server-side secret storage, and its matching `VERIFICATION_SIGNER` address.
3. A successful dry run of `script/Deploy.s.sol:DeploySettleva` on chain ID 5042.
4. A planned hosting configuration for the deployed contract address, matching frontend address, RPC URLs, chain ID and production `DATABASE_URL`.
5. A real authoritative source integration for the first settlement test.

After broadcasting, record the deployment transaction and address, verify on-chain bytecode, `verificationSigner()`, and `ARC_USDC()`, apply the replay/session database migration, and run `pnpm --filter @settleva/web preflight:mainnet`. Do not treat preflight alone as proof of settlement. The first acceptance test must complete real USDC funding → authentic source evidence → payment-bound backend attestation → payee release, followed by negative-condition and replay tests and a separate expiry/refund test.


## Submission evidence

Publish only facts that can be reproduced: repository URL, demo URL, relevant CI results for the submitted commit, deployed contract address/transaction if actually deployed, and the source-to-settlement transaction if actually completed. State plainly which scenario interactions are simulations.
