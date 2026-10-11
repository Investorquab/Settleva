import { isAddress, type Address, type Hex } from "viem";
import type { PreparedCreatePayment } from "./client.js";
import { toTokenUnits } from "./amount.js";
import { ARC_USDC_ADDRESS } from "./arc.js";

export const ERC20_APPROVAL_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }]
  }
] as const;

/** ABI surface consumed by the SDK transaction helpers and backend chain checks. */
export const SETTLEVA_ABI = [
  {
    type: "function",
    name: "ARC_USDC",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "createPayment",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentId", type: "bytes32" }, { name: "payee", type: "address" },
      { name: "token", type: "address" }, { name: "amount", type: "uint256" },
      { name: "expiry", type: "uint64" }, { name: "conditionHash", type: "bytes32" },
      { name: "providerHash", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "release",
    stateMutability: "nonpayable",
    inputs: [
      { name: "paymentId", type: "bytes32" }, { name: "proofIdentifier", type: "bytes32" },
      { name: "verificationSignature", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "paymentId", type: "bytes32" }],
    outputs: []
  },
  {
    type: "function",
    name: "payments",
    stateMutability: "view",
    inputs: [{ name: "paymentId", type: "bytes32" }],
    outputs: [
      { name: "payer", type: "address" }, { name: "payee", type: "address" },
      { name: "token", type: "address" }, { name: "amount", type: "uint256" },
      { name: "expiry", type: "uint64" }, { name: "conditionHash", type: "bytes32" },
      { name: "providerHash", type: "bytes32" }, { name: "status", type: "uint8" }
    ]
  },
  {
    type: "function",
    name: "verificationAttestationHash",
    stateMutability: "view",
    inputs: [
      { name: "paymentId", type: "bytes32" }, { name: "conditionHash", type: "bytes32" },
      { name: "providerHash", type: "bytes32" }, { name: "proofIdentifier", type: "bytes32" }
    ],
    outputs: [{ name: "", type: "bytes32" }]
  }
] as const;

function assertAddress(value: string, name: string): asserts value is Address {
  if (!isAddress(value)) throw new Error(name + " must be a valid EVM address");
}

function assertArcUsdc(value: string): asserts value is Address {
  assertAddress(value, "Settlement token");
  if (value.toLowerCase() !== ARC_USDC_ADDRESS.toLowerCase()) {
    throw new Error("Settleva only supports Arc USDC (" + ARC_USDC_ADDRESS + ")");
  }
}

export function buildApprovalCall(
  prepared: PreparedCreatePayment,
  settlevaAddress: Address,
  tokenDecimals: number
) {
  assertAddress(settlevaAddress, "Settleva contract address");
  assertArcUsdc(prepared.request.token);
  const amount = toTokenUnits(prepared.request.amount, tokenDecimals);
  return {
    address: prepared.request.token,
    abi: ERC20_APPROVAL_ABI,
    functionName: "approve" as const,
    args: [settlevaAddress, amount] as const
  };
}

export function buildCreatePaymentCall(
  prepared: PreparedCreatePayment,
  settlevaAddress: Address,
  tokenDecimals: number
) {
  assertAddress(settlevaAddress, "Settleva contract address");
  assertArcUsdc(prepared.request.token);
  const amount = toTokenUnits(prepared.request.amount, tokenDecimals);
  return {
    address: settlevaAddress,
    abi: SETTLEVA_ABI,
    functionName: "createPayment" as const,
    args: [
      prepared.paymentId,
      prepared.request.payee,
      prepared.request.token,
      amount,
      BigInt(prepared.request.expiry),
      prepared.conditionHash,
      prepared.providerHash
    ] as const
  };
}

export function buildReleasePaymentCall(input: {
  readonly settlevaAddress: Address;
  readonly paymentId: Hex;
  readonly proofIdentifier: Hex;
  readonly verificationSignature: Hex;
}) {
  assertAddress(input.settlevaAddress, "Settleva contract address");
  return {
    address: input.settlevaAddress,
    abi: SETTLEVA_ABI,
    functionName: "release" as const,
    args: [input.paymentId, input.proofIdentifier, input.verificationSignature] as const
  };
}

export function buildRefundPaymentCall(input: {
  readonly settlevaAddress: Address;
  readonly paymentId: Hex;
}) {
  assertAddress(input.settlevaAddress, "Settleva contract address");
  return {
    address: input.settlevaAddress,
    abi: SETTLEVA_ABI,
    functionName: "refund" as const,
    args: [input.paymentId] as const
  };
}
