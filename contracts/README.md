# Settleva Contracts

Settleva provides reusable conditional USDC settlement contract code for developer integrations on Arc. Each payment stores its own payer, payee, supported token, amount, expiry, condition commitment, provider commitment and status.

## Verification model

The contract accepts a payment-bound settlement attestation from the verifier address configured for that contract instance. It does not itself verify Reclaim proofs or external Web2 events on-chain. A verification backend must validate authoritative source evidence, bind it to the funded payment and exact condition, reject replay, and sign only after all checks pass.

**V1 deployment model:** Settleva keeps one canonical Solidity implementation in this repository. Each integrator may deploy its own instance and choose its own verificationSigner at construction. The Settleva demo instance is not a mandatory shared signer service. An integrator operating its own instance controls its own deployment wallet and server-side verifier key. Never expose private keys in browser code or the SDK.

The current verificationSigner is immutable in a deployed instance. Changing it requires a replacement deployment. Keep the deployer key and verifier key separate. A compromise of the configured verifier key can authorize invalid releases within the contract's enforced rules, so each integrator must protect the key and disclose this backend-attested trust boundary.

## Payment conditions and redeployment

The condition belongs to a payment, not to a deployment. When a developer calls createPayment, they pass the payment's amount, payee, expiry, condition hash and provider hash. A new payment can use different conditions without redeploying the contract.

The current contract does not provide an edit-in-place operation for an already funded payment. Release and refund are terminal outcomes. If an application needs funded-payment amendment or cancellation before expiry, that must be designed as explicit contract functionality and reviewed separately.

A redeployment is for a deployment-level change, such as a new contract implementation or replacing the immutable verifier for that integration. It is not needed for every escrow.

## Arc mainnet

- Chain ID: 5042
- RPC: https://rpc.mainnet.arc.io
- Arc USDC ERC-20 interface: 0x3600000000000000000000000000000000000000, 6 decimals.
- Arc native USDC for gas/value uses 18 decimals; do not reuse native units for ERC-20 transfers.
- Settleva accepts only the canonical Arc USDC ERC-20 address, exposed by ARC_USDC().

## Deploy an integrator-owned instance

The deployment script refuses to run unless the connected chain ID is Arc mainnet (5042). Configure these values in a secure local environment:

- DEPLOYER_PRIVATE_KEY — signs the deployment transaction and pays gas.
- SETTLEVA_VERIFIER_PRIVATE_KEY — separate server-side attestation signer key for this deployment.
- VERIFICATION_SIGNER — the EVM address derived from SETTLEVA_VERIFIER_PRIVATE_KEY.
- ARC_RPC_URL — Arc mainnet RPC URL.

From contracts/ in Ubuntu/WSL, prompt for the keys without echoing them, derive the verifier address, then run the script:

    export ARC_RPC_URL="https://rpc.mainnet.arc.io"
    read -rsp "Deployer private key: " DEPLOYER_PRIVATE_KEY; echo; export DEPLOYER_PRIVATE_KEY
    read -rsp "Dedicated verifier private key: " SETTLEVA_VERIFIER_PRIVATE_KEY; echo; export SETTLEVA_VERIFIER_PRIVATE_KEY
    export VERIFICATION_SIGNER="$(arc-cast wallet address --private-key "$SETTLEVA_VERIFIER_PRIVATE_KEY")"
    FOUNDRY_PROFILE=arc arc-forge script script/Deploy.s.sol:DeploySettleva --rpc-url "$ARC_RPC_URL" --broadcast -vvvv

The script checks that the verifier key derives the supplied signer address and differs from the deployer key. Complete a dry run and check the deployer balance before broadcasting. After deployment, configure the integrator's backend and application with the exact address, chain ID and matching server-side verifier key.

Never put private keys in source control, client-side environment variables, logs or chat. Before using real funds, verify deployed bytecode and constructor configuration, then complete a controlled low-value USDC funding → evidence verification → attestation → payee release test, plus invalid-evidence and expiry-refund tests.

## Deferred Reclaim work

The Reclaim/GitHub deployment proof experiment is not required by the base contract or SDK. Its existing source and provider notes are preserved at [Future Integrations: Reclaim](../future-integrations/reclaim/README.md).
