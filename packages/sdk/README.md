# @settleva/sdk

The SDK prepares deterministic payment commitments and builds viem-compatible transaction calls for the shared Settleva contract. It does not custody funds, prove external events, or decide whether provider evidence is valid.

> Current distribution status: this package is private to the Settleva monorepo. It is not yet published as an independently installable npm package.

## Prepare a conditional payment

The payment expiry and policy expiry must be identical. Amounts are normalized before deriving the payment ID, so equivalent values such as `"01.5000"` and `"1.5"` produce the same amount representation.

```ts
import {
  buildApprovalCall,
  buildCreatePaymentCall,
  prepareCreatePayment,
  toTokenUnits
} from "@settleva/sdk";
import type { PaymentCondition } from "@settleva/conditions";

const expiresAt = Math.floor(Date.now() / 1000) + 86_400;
const condition: PaymentCondition = {
  version: "1.0",
  provider: "your-evidence-provider",
  providerVersion: "1",
  claims: [
    { field: "milestone.status", operator: "equals", value: "accepted" }
  ],
  expiresAt
};

const prepared = prepareCreatePayment({
  payer,
  payee,
  token,
  amount: "25",
  expiry: expiresAt,
  condition
});

// This does not send a transaction. Your wallet client asks the user to approve it.
const approvalCall = buildApprovalCall(prepared, settlevaAddress, 6);
await walletClient.writeContract({ account, ...approvalCall });

const fundingCall = buildCreatePaymentCall(prepared, settlevaAddress, 6);
await walletClient.writeContract({ account, ...fundingCall });
```

`buildApprovalCall` and `buildCreatePaymentCall` return typed viem call objects; the host application retains wallet control and must wait for transaction receipts. The example assumes ERC-20 token decimals are known. For Arc USDC, use 6 decimals, and confirm the token address before funding.

## Commitment invariants

- The payment ID includes payer, payee, token, normalized human-readable amount, expiry and canonical policy.
- The condition hash is the Keccak-256 digest of deterministic canonical policy JSON.
- The provider hash is Keccak-256 of the provider ID; the policy hash also commits to the pinned provider version.
- The proof context binds the payment ID and condition hash.
- `toTokenUnits(amount, decimals)` validates supported decimal precision before a transaction is built.
- Payment expiry must exactly match `condition.expiresAt`, and it must still be in the future.
- Empty policies, duplicate claim fields, malformed claims and unsupported operators are rejected before a commitment is prepared.

## Arc asset and chain guarantees

The current production contract is USDC-specific. `prepareCreatePayment` and the transaction-call builders reject token addresses other than Arc's ERC-20 USDC interface (`0x3600000000000000000000000000000000000000`). This is intentional: the contract enforces the same allowlist through `ARC_USDC()`, and mainnet preflight verifies the deployed getter.

Arc uses two decimal scales for the same underlying USDC balance:
- Native value/gas: 18 decimals.
- ERC-20 `transfer`, `approve`, and escrow amount: 6 decimals.

Use `ARC_MAINNET_CHAIN_ID`, `ARC_MAINNET_RPC_URL`, `ARC_EXPLORER_URL`, `ARC_USDC_ADDRESS`, and `ARC_USDC_DECIMALS` from the SDK constants rather than copying these values across application code. The SDK only builds calls; it does not sign transactions or verify external evidence.

## Responsibility boundaries

- **SDK:** validates payment inputs, canonicalizes policy, derives deterministic identifiers and builds transaction calls.
- **Evidence provider:** obtains an authoritative signal for the use case. A successful API response is not automatically a cryptographic proof.
- **Backend:** verifies the configured provider proof/version, binds the result to the funded on-chain payment and condition, evaluates verified claims, enforces persistent replay protection, and signs the settlement attestation.
- **Contract:** holds the specified ERC-20 amount and enforces payment state, expiry, payee-only release, attestation authorization, proof replay rejection and eligible payer refunds.

The implemented Reclaim verification path supports the five GitHub deployment-status claims, but production use still requires a real published provider ID/version and matching app credentials. Gaming, freelance, commerce and agent examples in the homepage playground are simulations until corresponding authoritative evidence adapters are implemented and validated.

The current policy language supports the `equals` operator only. A passing playground result is not external proof, does not create an attestation, and does not transfer USDC.
