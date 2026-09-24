import { strict as assert } from "node:assert";
import { keccak256, stringToHex, recoverMessageAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { buildVerificationAttestationHash } from "./verification.js";

const base = {
  paymentId: keccak256(stringToHex("payment-1")),
  conditionHash: keccak256(stringToHex("condition-1")),
  providerHash: keccak256(stringToHex("provider-1")),
  proofIdentifier: keccak256(stringToHex("proof-1"))
} as const;

const first = buildVerificationAttestationHash(base);
assert.equal(first.length, 66);
assert.equal(first, buildVerificationAttestationHash(base));

for (const field of Object.keys(base) as Array<keyof typeof base>) {
  const mutated = {...base, [field]: keccak256(stringToHex(`mutated-${field}`))};
  assert.notEqual(buildVerificationAttestationHash(mutated), first, `attestation must bind ${field}`);
}

const signer = privateKeyToAccount("0x0123456789012345678901234567890123456789012345678901234567890123");
const signature = await signer.signMessage({message:{raw:first}});
const recovered = await recoverMessageAddress({message:{raw:first}, signature});
assert.equal(recovered, signer.address, "attestation signature must recover against the Solidity message-prefix scheme");
