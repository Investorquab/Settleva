import { encodeAbiParameters, keccak256, type Hex } from "viem";

export interface VerificationAttestationInput {
  readonly paymentId: Hex;
  readonly conditionHash: Hex;
  readonly providerHash: Hex;
  readonly proofIdentifier: Hex;
}

/**
 * Hash signed by the Settleva verification service.
 * The Solidity contract wraps this hash with the standard Ethereum
 * signed-message prefix before recovering the configured signer.
 */
export function buildVerificationAttestationHash(
  input: VerificationAttestationInput
): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        {type:"bytes32"},
        {type:"bytes32"},
        {type:"bytes32"},
        {type:"bytes32"}
      ],
      [
        input.paymentId,
        input.conditionHash,
        input.providerHash,
        input.proofIdentifier
      ]
    )
  );
}
