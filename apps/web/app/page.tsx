"use client";

import { useMemo, useState } from "react";
import { createPublicClient, createWalletClient, custom, http, parseUnits, type Address, type Hex } from "viem";
import { prepareCreatePayment } from "@settleva/sdk";
import type { PaymentCondition } from "@settleva/conditions";
import { erc20Abi, settlevaAbi } from "./contracts";

const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || "5042");
const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || "";
const SETTLEVA_ADDRESS = (process.env.NEXT_PUBLIC_SETTLEVA_ADDRESS || "") as Address;

declare global {
  interface Window { ethereum?: { request(args:{method:string;params?:unknown[]}):Promise<unknown> } }
}

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

function configured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(SETTLEVA_ADDRESS) &&
    /^https?:\/\//.test(ARC_RPC_URL) &&
    ARC_RPC_URL !== "https://YOUR_ARC_RPC";
}

export default function Home() {
  const [payer,setPayer] = useState("");
  const [payee,setPayee] = useState("");
  const [token,setToken] = useState("");
  const [amount,setAmount] = useState("1");
  const [expiresAt,setExpiresAt] = useState(String(Math.floor(Date.now()/1000)+86400));
  const [provider,setProvider] = useState("github");
  const [field,setField] = useState("repo.public");
  const [value,setValue] = useState("true");
  const [result,setResult] = useState<ReturnType<typeof prepareCreatePayment>|null>(null);
  const [error,setError] = useState("");
  const [txHash,setTxHash] = useState<Hex | "">("");
  const [funding,setFunding] = useState(false);

  const condition = useMemo<PaymentCondition>(() => ({
    version:"1.0",provider,claims:[{field,operator:"equals",value}],expiresAt:Number(expiresAt)
  }),[provider,field,value,expiresAt]);

  function prepare() {
    setError(""); setResult(null); setTxHash("");
    try {
      const safePayer=(payer || ZERO) as Address;
      const safePayee=(payee || ZERO) as Address;
      const safeToken=(token || ZERO) as Address;
      if (!payer || !payee || !token) throw new Error("Enter payer, payee and token addresses.");
      setResult(prepareCreatePayment({payer:safePayer,payee:safePayee,token:safeToken,amount,expiry:Number(expiresAt),condition}));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not prepare payment."); }
  }

  async function connectWallet() {
    setError("");
    if (!window.ethereum) throw new Error("No injected wallet found. Install or open a compatible EVM wallet.");
    const accounts = await window.ethereum.request({method:"eth_requestAccounts"}) as string[];
    if (!accounts[0]) throw new Error("Wallet returned no account.");
    setPayer(accounts[0]);
  }

  async function fundPayment() {
    setError(""); setFunding(true);
    try {
      if (!result) throw new Error("Prepare the payment first.");
      if (!configured()) throw new Error("Set NEXT_PUBLIC_ARC_RPC_URL and NEXT_PUBLIC_SETTLEVA_ADDRESS before funding.");
      if (!window.ethereum) throw new Error("No injected wallet found.");
      const accounts = await window.ethereum.request({method:"eth_requestAccounts"}) as string[];
      const account = accounts[0] as Address | undefined;
      if (!account) throw new Error("Connect a wallet first.");
      if (account.toLowerCase() !== result.request.payer.toLowerCase()) {
        throw new Error("Connected wallet does not match the payer.");
      }

      const chain = {
        id:ARC_CHAIN_ID,
        name:"Arc",
        nativeCurrency:{name:"USDC",symbol:"USDC",decimals:6},
        rpcUrls:{default:{http:[ARC_RPC_URL]}}
      } as const;
      const publicClient = createPublicClient({chain,transport:http(ARC_RPC_URL)});
      const walletClient = createWalletClient({chain,transport:custom(window.ethereum)});

      const decimals = await publicClient.readContract({
        address:result.request.token, abi:erc20Abi, functionName:"decimals"
      });
      const units = parseUnits(result.request.amount, decimals);
      const approveHash = await walletClient.writeContract({
        account, address:result.request.token, abi:erc20Abi, functionName:"approve",
        args:[SETTLEVA_ADDRESS,units]
      });
      await publicClient.waitForTransactionReceipt({hash:approveHash});

      const hash = await walletClient.writeContract({
        account, address:SETTLEVA_ADDRESS, abi:settlevaAbi, functionName:"createPayment",
        args:[
          result.paymentId,
          result.request.payee,
          result.request.token,
          units,
          BigInt(result.request.expiry),
          result.conditionHash,
          result.contextHash
        ]
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({hash});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Funding transaction failed.");
    } finally { setFunding(false); }
  }

  return <main>
    <div style={{marginBottom:28}}>
      <div className="muted">SETTLEVA / REFERENCE CONSOLE</div>
      <h1 style={{fontSize:48,margin:"8px 0"}}>Condition → proof → settlement.</h1>
      <p className="muted" style={{maxWidth:700}}>Prepare an evidence-bound USDC payment without custody. The console commits the exact condition and proof context that the settlement contract will enforce.</p>
    </div>
    <div className="grid">
      <section className="card">
        <h2>1. Define payment</h2>
        <div className="row">
          <div><label className="label">Payer</label><input value={payer} onChange={e=>setPayer(e.target.value)} placeholder="0x..." /></div>
          <div><label className="label">Payee</label><input value={payee} onChange={e=>setPayee(e.target.value)} placeholder="0x..." /></div>
        </div>
        <div style={{marginTop:12}}><label className="label">Settlement token</label><input value={token} onChange={e=>setToken(e.target.value)} placeholder="ERC-20 address" /></div>
        <div className="row" style={{marginTop:12}}>
          <div><label className="label">Amount</label><input value={amount} onChange={e=>setAmount(e.target.value)} /></div>
          <div><label className="label">Expiry (Unix seconds)</label><input value={expiresAt} onChange={e=>setExpiresAt(e.target.value)} /></div>
        </div>
        <h2 style={{marginTop:28}}>2. Define condition</h2>
        <div><label className="label">Proof provider</label><input value={provider} onChange={e=>setProvider(e.target.value)} /></div>
        <div className="row" style={{marginTop:12}}>
          <div><label className="label">Claim field</label><input value={field} onChange={e=>setField(e.target.value)} /></div>
          <div><label className="label">Required value</label><input value={value} onChange={e=>setValue(e.target.value)} /></div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={prepare}>Prepare commitment</button>
          <button onClick={()=>void connectWallet()}>Connect wallet</button>
        </div>
        {result && <button disabled={funding} onClick={()=>void fundPayment()} style={{marginTop:10,width:"100%"}}>
          {funding ? "Funding…" : "Approve + fund on Arc"}
        </button>}
        {error && <p style={{color:"#b42318"}}>{error}</p>}
        {txHash && <><p className="label">Funding transaction</p><pre>{txHash}</pre></>}
      </section>
      <section className="card">
        <h2>Commitment</h2>
        {!result ? <p className="muted">Nothing committed yet. The SDK canonicalizes the condition and derives the identifiers locally.</p> :
        <>
          <p className="label">Payment ID</p><pre>{result.paymentId}</pre>
          <p className="label">Condition hash</p><pre>{result.conditionHash}</pre>
          <p className="label">Exact proof context</p><pre>{result.proofContext}</pre>
          <p className="label">Context hash committed by contract</p><pre>{result.contextHash}</pre>
          <p className="label">Canonical condition</p><pre>{JSON.stringify(condition,null,2)}</pre>
        </>}
      </section>
    </div>
  </main>;
}
