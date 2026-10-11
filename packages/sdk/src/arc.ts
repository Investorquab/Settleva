/** Canonical Arc mainnet settings shared by SDK and host applications. */
export const ARC_MAINNET_CHAIN_ID = 5042 as const;
export const ARC_MAINNET_RPC_URL = "https://rpc.mainnet.arc.io" as const;
export const ARC_EXPLORER_URL = "https://explorer.arc.io" as const;
export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;
export const ARC_USDC_DECIMALS = 6 as const;
export const ARC_NATIVE_CURRENCY = { name: "USDC", symbol: "USDC", decimals: 18 } as const;
