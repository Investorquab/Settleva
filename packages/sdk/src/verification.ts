import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";

export interface VerificationAttestationInput {
  readonly chainId: bigint;
  readonly verifyingContract: Address;
  readonly paymentId: Hex;
  readonly conditionHash: Hex;
  readonly providerHash: Hex;
  readonly proofIdentifier: Hex;
}

/**
 * Hash signed by the Settleva verification service.
 * The digest is domain-bound to the chain and exact contract deployment.
 * Solidity wraps this hash with the standard Ethereum signed-message prefix.
 */
export function buildVerificationAttestationHash(
  input: VerificationAttestationInput
): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        {type:"uint256"},
        {type:"address"},
        {type:"bytes32"},
        {type:"bytes32"},
        {type:"bytes32"},
        {type:"bytes32"}
      ],
      [
        input.chainId,
        input.verifyingContract,
        input.paymentId,
        input.conditionHash,
        input.providerHash,
        input.proofIdentifier
      ]
    )
  );
}
