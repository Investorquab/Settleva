import postgres from "postgres";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const EXPECTED_CHAIN_ID = 5042;
const ARC_USDC = "0x3600000000000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const SETTLEVA_ABI = [
  {
    type: "function",
    name: "ARC_USDC",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "verificationSigner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  }
];
const ERC20_DECIMALS_ABI = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }]
  }
];

const failures = [];
let passed = 0;

function pass(label) {
  passed += 1;
  console.log(`PASS  ${label}`);
}

function fail(label, error) {
  const message = error instanceof Error ? error.message : String(error);
  failures.push(label);
  console.error(`FAIL  ${label}: ${message}`);
}

async function check(label, action) {
  try {
    await action();
    pass(label);
    return true;
  } catch (error) {
    fail(label, error);
    return false;
  }
}

function configured(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing`);
  if (/YOUR_|your_|REPLACE_ME|placeholder|USER:PASSWORD|HOST\/DATABASE/i.test(value)) {
    throw new Error(`${name} still contains a template value`);
  }
  return value;
}

function requireHttpsUrl(value, name) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
  if (parsed.protocol !== "https:") throw new Error(`${name} must use HTTPS`);
  if (parsed.username || parsed.password) throw new Error(`${name} must not embed credentials`);
  return parsed;
}

const envNames = [
  "ARC_RPC_URL",
  "NEXT_PUBLIC_ARC_RPC_URL",
  "SETTLEVA_CHAIN_ID",
  "NEXT_PUBLIC_ARC_CHAIN_ID",
  "SETTLEVA_CONTRACT_ADDRESS",
  "NEXT_PUBLIC_SETTLEVA_ADDRESS",
  "SETTLEVA_VERIFIER_PRIVATE_KEY",
  "DATABASE_URL"
];

const values = {};
for (const name of envNames) {
  try {
    values[name] = configured(name);
    pass(`${name} is set and not a template value`);
  } catch (error) {
    fail(`${name} configuration`, error);
  }
}

let serverContractAddress;
let publicContractAddress;
let verifierAccount;

await check("Server and frontend chain IDs are both Arc mainnet (5042)", () => {
  if (values.SETTLEVA_CHAIN_ID !== String(EXPECTED_CHAIN_ID)) {
    throw new Error("SETTLEVA_CHAIN_ID must be 5042");
  }
  if (values.NEXT_PUBLIC_ARC_CHAIN_ID !== String(EXPECTED_CHAIN_ID)) {
    throw new Error("NEXT_PUBLIC_ARC_CHAIN_ID must be 5042");
  }
});

await check("Server and frontend point to the same non-zero contract address", () => {
  const server = values.SETTLEVA_CONTRACT_ADDRESS;
  const browser = values.NEXT_PUBLIC_SETTLEVA_ADDRESS;
  if (!server || !browser || !isAddress(server) || !isAddress(browser)) {
    throw new Error("Both contract address variables must be valid EVM addresses");
  }
  serverContractAddress = getAddress(server);
  publicContractAddress = getAddress(browser);
  if (serverContractAddress === ZERO_ADDRESS || publicContractAddress === ZERO_ADDRESS) {
    throw new Error("The zero address is still configured");
  }
  if (serverContractAddress !== publicContractAddress) {
    throw new Error("SETTLEVA_CONTRACT_ADDRESS and NEXT_PUBLIC_SETTLEVA_ADDRESS differ");
  }
});

let serverRpcUrl;
let browserRpcUrl;
await check("Arc RPC URLs use HTTPS", () => {
  serverRpcUrl = requireHttpsUrl(values.ARC_RPC_URL, "ARC_RPC_URL").toString();
  browserRpcUrl = requireHttpsUrl(values.NEXT_PUBLIC_ARC_RPC_URL, "NEXT_PUBLIC_ARC_RPC_URL").toString();
});

await check("Verifier private key is valid and derives an EVM signer", () => {
  const key = values.SETTLEVA_VERIFIER_PRIVATE_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("SETTLEVA_VERIFIER_PRIVATE_KEY must be a 32-byte 0x-prefixed private key");
  }
  verifierAccount = privateKeyToAccount(key);
});

let serverClient;
let browserClient;
if (serverRpcUrl) {
  try {
    serverClient = createPublicClient({ transport: http(serverRpcUrl, { timeout: 12_000 }) });
  } catch (error) {
    fail("Server Arc RPC client configuration", error);
  }
}
if (browserRpcUrl) {
  try {
    browserClient = createPublicClient({ transport: http(browserRpcUrl, { timeout: 12_000 }) });
  } catch (error) {
    fail("Frontend Arc RPC client configuration", error);
  }
}

let serverChainOk = false;
if (serverClient) {
  serverChainOk = await check("Server Arc RPC responds with chain ID 5042", async () => {
    const chainId = await serverClient.getChainId();
    if (chainId !== EXPECTED_CHAIN_ID) throw new Error(`RPC reports chain ID ${chainId}`);
  });
}
if (browserClient) {
  await check("Frontend Arc RPC responds with chain ID 5042", async () => {
    const chainId = await browserClient.getChainId();
    if (chainId !== EXPECTED_CHAIN_ID) throw new Error(`RPC reports chain ID ${chainId}`);
  });
}

if (serverClient && serverChainOk) {
  await check("Arc USDC contract exists and reports six decimals", async () => {
    const code = await serverClient.getBytecode({ address: ARC_USDC });
    if (!code || code === "0x") throw new Error("No bytecode found at the documented Arc USDC address");
    const decimals = await serverClient.readContract({
      address: ARC_USDC,
      abi: ERC20_DECIMALS_ABI,
      functionName: "decimals"
    });
    if (decimals !== 6) throw new Error(`USDC decimals were ${decimals}, expected 6`);
  });

  if (serverContractAddress) {
    await check("Settleva contract has deployed bytecode", async () => {
      const code = await serverClient.getBytecode({ address: serverContractAddress });
      if (!code || code === "0x") throw new Error("No bytecode found at SETTLEVA_CONTRACT_ADDRESS");
    });

    await check("Deployed Settleva contract enforces the canonical Arc USDC interface", async () => {
      const token = await serverClient.readContract({
        address: serverContractAddress,
        abi: SETTLEVA_ABI,
        functionName: "ARC_USDC"
      });
      if (getAddress(token) !== getAddress(ARC_USDC)) {
        throw new Error("Deployed contract ARC_USDC getter does not match the documented Arc USDC address");
      }
    });

    if (verifierAccount) {
      await check("On-chain immutable verification signer matches the configured private key", async () => {
        const signer = await serverClient.readContract({
          address: serverContractAddress,
          abi: SETTLEVA_ABI,
          functionName: "verificationSigner"
        });
        if (getAddress(signer) !== getAddress(verifierAccount.address)) {
          throw new Error("Configured verifier key does not derive the deployed contract's verificationSigner");
        }
      });
    }
  }
}

if (values.DATABASE_URL) {
  await check("Production replay/session database accepts a query", async () => {
    let sql;
    try {
      sql = postgres(values.DATABASE_URL, { max: 1, connect_timeout: 8, idle_timeout: 1 });
      const rows = await sql`select 1 as settleva_preflight`;
      if (Number(rows[0]?.settleva_preflight) !== 1) throw new Error("Database probe returned an unexpected result");

      const tables = await sql`
        select to_regclass('public.settleva_evidence_replay') as replay_table
      `;
      if (!tables[0]?.replay_table) {
        throw new Error("Provider-neutral evidence replay table is missing; run pnpm --filter @settleva/web db:migrate");
      }

      const columns = await sql`
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'settleva_evidence_replay'
      `;
      const actualColumns = new Set(columns.map((row) => row.column_name));
      const requiredColumns = [
        "identifier_type",
        "identifier",
        "session_id",
        "proof_identifier",
        "payment_id",
        "condition_hash",
        "accepted_at"
      ];
      const missingColumns = requiredColumns.filter((column) => !actualColumns.has(column));
      if (missingColumns.length) {
        throw new Error("Evidence replay schema is incomplete (" + missingColumns.join(", ") + "); run pnpm --filter @settleva/web db:migrate");
      }

      const indexes = await sql`
        select indexname from pg_indexes
        where schemaname = 'public'
          and indexname in (
            'settleva_evidence_replay_session_idx',
            'settleva_evidence_replay_proof_idx'
          )
      `;
      const existingIndexes = new Set(indexes.map((row) => row.indexname));
      const requiredIndexes = [
        "settleva_evidence_replay_session_idx",
        "settleva_evidence_replay_proof_idx"
      ];
      const missingIndexes = requiredIndexes.filter((indexName) => !existingIndexes.has(indexName));
      if (missingIndexes.length) {
        throw new Error("Evidence replay indexes are missing (" + missingIndexes.join(", ") + "); run pnpm --filter @settleva/web db:migrate");
      }
    } finally {
      if (sql) await sql.end({ timeout: 3 });
    }
  });
}

console.log("");
console.log(`Mainnet preflight: ${passed} passed, ${failures.length} failed.`);
if (failures.length) {
  console.error("Do not treat this environment as mainnet-ready until every check passes.");
  process.exitCode = 1;
} else {
  console.log("Preflight checks passed. This confirms configuration/infrastructure only; it does not prove a real settlement works.");
}
