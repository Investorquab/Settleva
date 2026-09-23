# @settleva/sdk

The SDK is responsible for deterministic preparation of a conditional payment.

It does not custody funds and does not decide whether evidence is valid.

## Preparation

```ts
import { prepareCreatePayment } from "@settleva/sdk";

const prepared = prepareCreatePayment({
  payer,
  payee,
  token,
  amount: "1000000",
  expiry,
  condition
});

console.log(prepared.paymentId);
console.log(prepared.conditionHash);
```

The returned values are intended to be passed to the Settleva contract transaction layer.

The SDK deliberately keeps chain execution separate from condition construction so applications can use their own wallet/provider stack.
