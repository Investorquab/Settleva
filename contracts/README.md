# Settleva Contracts

Settleva escrows ERC-20 payments and releases them only when a trusted verification service signs an attestation for the exact funded commitment.

## Verification model

Reclaim proof verification and semantic condition evaluation happen in the backend using Reclaim's maintained JavaScript SDK. The backend must:

- verify the raw proof cryptographically with the pinned provider ID and exact provider version;
- bind the proof to a Reclaim session initiated for this payment;
- check the signed context against the payment ID and canonical condition hash;
- evaluate the verified extracted parameters against every committed condition claim;
- reject duplicate/replayed proofs using persistent replay protection;
- only then sign the settlement attestation.

The contract checks the signer against its immutable `verificationSigner`, and the signature commits to `paymentId`, the stored `conditionHash`, stored `providerHash`, and the Reclaim `proofIdentifier`. It also enforces payee-only release, expiry, payment status, proof-identifier uniqueness, and ERC-20 transfer success.

**Trust boundary:** this is backend-attested settlement, not trustless on-chain Reclaim proof verification. Compromise of the verification-signing key could authorize invalid settlements. Keep it server-side, never expose it to the browser, and use a dedicated key with minimal balance and documented rotation/revocation procedures. The contract has no signer rotation function, so changing the signer requires a new deployment.

## Arc mainnet

- Chain ID: `5042`
- RPC: `https://rpc.mainnet.arc.io`
- Arc USDC: `0x3600000000000000000000000000000000000000` (6 decimals)

## Deploy

The script refuses to run unless the connected chain ID is Arc mainnet (`5042`). Configure:

- `DEPLOYER_PRIVATE_KEY`
- `VERIFICATION_SIGNER` — the address derived from the backend's `SETTLEVA_VERIFIER_PRIVATE_KEY`

From `contracts/`:

```bash
export DEPLOYER_PRIVATE_KEY=...
export VERIFICATION_SIGNER=0x...
forge script script/Deploy.s.sol:DeploySettleva --rpc-url "$ARC_MAINNET_RPC_URL" --broadcast -vvvv
```

Do not put private keys in source control, client-side environment variables, logs, or chat. Before real funds are used, deploy to Arc mainnet, verify the deployed bytecode/constructor configuration, run an end-to-end low-value USDC test, and publish the contract and transaction links.
