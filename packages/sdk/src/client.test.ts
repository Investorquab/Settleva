import { prepareCreatePayment } from "./client.js";

const base = {
  payer:"0x1111111111111111111111111111111111111111" as const,
  payee:"0x2222222222222222222222222222222222222222" as const,
  token:"0x3333333333333333333333333333333333333333" as const,
  amount:"1.5",
  expiry:1_800_000_000,
  condition:{
    version:"1.0" as const,
    provider:"github",
    claims:[{field:"repo.public",operator:"equals" as const,value:"true"}],
    expiresAt:1_800_000_000
  }
};

const prepared = prepareCreatePayment(base);
if (!prepared.paymentId.startsWith("0x") || prepared.paymentId.length !== 66) throw new Error("payment id failed");
if (prepared.conditionHash.length !== 66) throw new Error("condition hash failed");
if (prepared.proofContext !== prepared.conditionHash) throw new Error("proof context must equal condition hash");
if (prepared.contextHash.length !== 66) throw new Error("context hash failed");
