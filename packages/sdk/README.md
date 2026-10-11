# @settleva/sdk

The SDK prepares deterministic payment commitments. It does not custody funds, prove external events or decide whether provider evidence is valid.

## Prepare a conditional payment

```ts
import { prepareCreatePayment } from "@settleva/sdk";
import type { PaymentCondition } from "@settleva/conditions";

const condition: PaymentCondition = {
  version: "1.0",
  provider: "your-evidence-provider",
  providerVersion: "1",
  claims: [
    {
      field: "milestone.status",
      operator: "equals",
      value: "accepted"
    }
  ],
  expiresAt: Math.floor(Date.now() / 1000) + 86_400
};

const prepared = prepareCreatePayment({
  payer,
  payee,
  token,
  amount: "25",
  expiry: condition.expiresAt,
  condition
});

// Use the prepared identifiers in the application's wallet transaction.
console.log(prepared.paymentId);
console.log(prepared.conditionHash);
console.log(prepared.providerHash);
```

The amount is a human-readable decimal string. Convert it to the token's atomic units when constructing the contract transaction (Arc USDC uses six decimals).

## Responsibilities remain separated

- The SDK creates deterministic identifiers and the exact condition commitment.
- A configured server-side provider integration verifies event evidence.
- The backend binds verification to payment/condition context and enforces replay protection before producing a settlement attestation.
- The shared Settleva contract enforces payment state and attestation authorization.

The current public condition schema supports the `equals` operator only. The website playground intentionally uses that same schema and evaluator. Demo evidence is illustrative and cannot authorize settlement.
