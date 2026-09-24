"use client";

import { useMemo, useState } from "react";
import { ReclaimProofRequest, transformForOnchain } from "@reclaimprotocol/js-sdk";
import { createPublicClient, createWalletClient, custom, http, parseUnits, type Address, type Hex } from "viem";
import { prepareCreatePayment } from "@settleva/sdk";
import type { PaymentCondition } from "@settleva/conditions";
import { GITHUB_DEPLOYMENT_CLAIM_FIELDS } from "@settleva/providers";
import { erc20Abi, settlevaAbi } from "./contracts";

const ARC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARC_CHAIN_ID || "5042");
const ARC_RPC_URL = process.env.NEXT_PUBLIC_ARC_RPC_URL || "";
const SETTLEVA_ADDRESS = (process.env.NEXT_PUBLIC_SETTLEVA_ADDRESS || "") as Address;
const RECLAIM_PROVIDER_ID = process.env.NEXT_PUBLIC_RECLAIM_PROVIDER_ID || "";
const RECLAIM_PROVIDER_VERSION = process.env.NEXT_PUBLIC_RECLAIM_PROVIDER_VERSION || "";

declare global {
  interface Window { ethereum?: { request(args:{method:string;params?:unknown[]}):Promise<unknown> } }
}

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
  const [provider,setProvider] = useState(RECLAIM_PROVIDER_ID || "github");
  const [providerVersion,setProviderVersion] = useState(RECLAIM_PROVIDER_VERSION);
  const [repository,setRepository] = useState("");
  const [ref,setRef] = useState("main");
  const [sha,setSha] = useState("");
  const [environment,setEnvironment] = useState("production");
  const [status,setStatus] = useState("success");
  const [result,setResult] = useState<ReturnType<typeof prepareCreatePayment>|null>(null);
  const [error,setError] = useState("");
  const [txHash,setTxHash] = useState<Hex | "">("");
  const [proofStatus,setProofStatus] = useState("");
  const [proof,setProof] = useState<unknown[]|null>(null);
  const [proofVerified,setProofVerified] = useState(false);
  const [verificationSignature,setVerificationSignature] = useState<Hex | "">("");
  const [reclaimSessionId,setReclaimSessionId] = useState("");
  const [funding,setFunding] = useState(false);
  const [verifying,setVerifying] = useState(false);
  const [settling,setSettling] = useState(false);
  const [settlementTx,setSettlementTx] = useState<Hex | "">("");

  const condition = useMemo<PaymentCondition>(() => ({
    version:"1.0",
    provider,
    providerVersion,
    claims:[
      {field:GITHUB_DEPLOYMENT_CLAIM_FIELDS.repository,operator:"equals",value:repository},
      {field:GITHUB_DEPLOYMENT_CLAIM_FIELDS.ref,operator:"equals",value:ref},
      {field:GITHUB_DEPLOYMENT_CLAIM_FIELDS.sha,operator:"equals",value:sha},
      {field:GITHUB_DEPLOYMENT_CLAIM_FIELDS.environment,operator:"equals",value:environment},
      {field:GITHUB_DEPLOYMENT_CLAIM_FIELDS.status,operator:"equals",value:status}
    ],
    expiresAt:Number(expiresAt)
  }),[provider,providerVersion,repository,ref,sha,environment,status,expiresAt]);

  function prepare() {
    setError(""); setResult(null); setTxHash(""); setProof(null); setProofVerified(false); setVerificationSignature(""); setReclaimSessionId(""); setSettlementTx("");
    try {
      if (!payer || !payee || !token) throw new Error("Enter payer, payee and token addresses.");
      setResult(prepareCreatePayment({payer:payer as Address,payee:payee as Address,token:token as Address,amount,expiry:Number(expiresAt),condition}));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not prepare payment."); }
  }

  async function connectWallet() {
    setError("");
    if (!window.ethereum) throw new Error("No injected wallet found.");
    const accounts = await window.ethereum.request({method:"eth_requestAccounts"}) as string[];
    if (!accounts[0]) throw new Error("Wallet returned no account.");
    setPayer(accounts[0]);
  }

  function arcClients() {
    if (!configured()) throw new Error("Set Arc RPC and Settleva address first.");
    if (!window.ethereum) throw new Error("No injected wallet found.");
    const chain = {id:ARC_CHAIN_ID,name:"Arc",nativeCurrency:{name:"USDC",symbol:"USDC",decimals:6},rpcUrls:{default:{http:[ARC_RPC_URL]}}} as const;
    return {
      publicClient:createPublicClient({chain,transport:http(ARC_RPC_URL)}),
      walletClient:createWalletClient({chain,transport:custom(window.ethereum)})
    };
  }

  async function fundPayment() {
    setError(""); setFunding(true);
    try {
      if (!result) throw new Error("Prepare the payment first.");
      const accounts = await window.ethereum?.request({method:"eth_requestAccounts"}) as string[];
      const account = accounts?.[0] as Address | undefined;
      if (!account || account.toLowerCase() !== result.request.payer.toLowerCase()) throw new Error("Connected wallet does not match the payer.");
      const {publicClient,walletClient}=arcClients();
      const decimals=await publicClient.readContract({address:result.request.token,abi:erc20Abi,functionName:"decimals"});
      const units=parseUnits(result.request.amount,decimals);
      const approveHash=await walletClient.writeContract({account,address:result.request.token,abi:erc20Abi,functionName:"approve",args:[SETTLEVA_ADDRESS,units]});
      await publicClient.waitForTransactionReceipt({hash:approveHash});
      const hash=await walletClient.writeContract({account,address:SETTLEVA_ADDRESS,abi:settlevaAbi,functionName:"createPayment",args:[result.paymentId,result.request.payee,result.request.token,units,BigInt(result.request.expiry),result.conditionHash,result.providerHash]});
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({hash});
    } catch (e) { setError(e instanceof Error ? e.message : "Funding transaction failed."); }
    finally { setFunding(false); }
  }

  async function requestProof() {
    setError(""); setProofStatus("Creating Reclaim request…"); setProofVerified(false);
    try {
      if (!result || !txHash) throw new Error("Fund the payment first.");
      const response=await fetch("/api/reclaim/request",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({context:result.proofContext,condition:result.request.condition})});
      const body=await response.json() as {request?:string;sessionId?:string;error?:string};
      if (!response.ok || !body.request || !body.sessionId) throw new Error(body.error || "Could not create Reclaim request.");
      setReclaimSessionId(body.sessionId);

      const reclaim=await ReclaimProofRequest.fromJsonString(body.request);
      setProofStatus("Reclaim verification started. Complete the provider flow.");
      await reclaim.startSession({
        onSuccess:()=>setProofStatus("Proof delivered to Settleva backend. Waiting for server verification…"),
        onError:(err)=>setProofStatus(`Reclaim error: ${err.message}`)
      });

      for (let attempt=0; attempt<60; attempt++) {
        await new Promise((resolve)=>setTimeout(resolve,2000));
        const statusResponse=await fetch(`/api/reclaim/status?sessionId=${encodeURIComponent(body.sessionId)}`);
        const status=await statusResponse.json() as {
          status?:string; proof?:unknown; verificationSignature?:Hex; error?:string
        };
        if (status.status === "verified" && status.proof && status.verificationSignature) {
          setProof(Array.isArray(status.proof) ? status.proof : [status.proof]);
          setVerificationSignature(status.verificationSignature);
          setProofVerified(true);
          setProofStatus("Backend callback verified the Reclaim proof.");
          return;
        }
        if (status.status === "failed") throw new Error(status.error || "Backend Reclaim verification failed.");
      }

      throw new Error("Timed out waiting for the Reclaim backend callback.");
    } catch(e){setProofStatus("");setError(e instanceof Error?e.message:"Could not complete Reclaim.");}
  }


  async function settlePayment() {
    setError(""); setSettling(true);
    try {
      if(!result || !proof || !proofVerified || !verificationSignature) throw new Error("Verify the Reclaim proof first.");
      const raw=proof[0] as Parameters<typeof transformForOnchain>[0];
      const transformed=transformForOnchain(raw);
      const {walletClient,publicClient}=arcClients();
      const accounts=await window.ethereum?.request({method:"eth_requestAccounts"}) as string[];
      const account=accounts?.[0] as Address|undefined;
      if(!account || account.toLowerCase()!==result.request.payee.toLowerCase()) throw new Error("Connect the payee wallet to settle this payment.");
      const hash=await walletClient.writeContract({
        account,address:SETTLEVA_ADDRESS,abi:settlevaAbi,functionName:"release",
        args:[result.paymentId,transformed,verificationSignature]
      });
      setSettlementTx(hash);
      await publicClient.waitForTransactionReceipt({hash});
      setProofStatus("Payment settled on Arc.");
    } catch(e){setError(e instanceof Error?e.message:"Settlement transaction failed.");}
    finally{setSettling(false);}
  }

  return <main>
    <div style={{marginBottom:28}}>
      <div className="muted">SETTLEVA / REFERENCE CONSOLE</div>
      <h1 style={{fontSize:48,margin:"8px 0"}}>Condition → proof → settlement.</h1>
      <p className="muted" style={{maxWidth:700}}>Prepare an evidence-bound USDC payment without custody. Reclaim generates and verifies the proof; Settleva binds release to the exact proof context committed at funding.</p>
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
        <div><label className="label">Reclaim provider ID</label><input value={provider} onChange={e=>setProvider(e.target.value)} placeholder="Configured Reclaim provider ID" /></div>
        <div style={{marginTop:12}}><label className="label">Reclaim provider version</label><input value={providerVersion} onChange={e=>setProviderVersion(e.target.value)} placeholder="Exact pinned provider version" /></div>
        <div style={{marginTop:12}}><label className="label">GitHub repository</label><input value={repository} onChange={e=>setRepository(e.target.value)} placeholder="owner/repository" /></div>
        <div className="row" style={{marginTop:12}}>
          <div><label className="label">Deployment ref</label><input value={ref} onChange={e=>setRef(e.target.value)} placeholder="main" /></div>
          <div><label className="label">Deployment SHA</label><input value={sha} onChange={e=>setSha(e.target.value)} placeholder="40-character commit SHA" /></div>
        </div>
        <div className="row" style={{marginTop:12}}>
          <div><label className="label">Environment</label><input value={environment} onChange={e=>setEnvironment(e.target.value)} placeholder="production" /></div>
          <div><label className="label">Required deployment status</label><input value={status} onChange={e=>setStatus(e.target.value)} placeholder="success" /></div>
        </div>
        <p className="muted" style={{marginTop:12}}>The condition commits the repository, ref, commit SHA, environment and deployment status. A GitHub API response alone is not accepted as proof.</p>
        <div style={{display:"flex",gap:10,marginTop:20}}>
          <button onClick={prepare}>Prepare commitment</button>
          <button onClick={()=>void connectWallet()}>Connect wallet</button>
        </div>
        {result && <button disabled={funding} onClick={()=>void fundPayment()} style={{marginTop:10,width:"100%"}}>{funding?"Funding…":"Approve + fund on Arc"}</button>}
        {result && txHash && <button onClick={()=>void requestProof()} style={{marginTop:10,width:"100%"}}>Request Reclaim proof</button>}
                {proofVerified && <button disabled={settling} onClick={()=>void settlePayment()} style={{marginTop:10,width:"100%"}}>{settling?"Settling…":"Release payment with proof"}</button>}
        {error && <p style={{color:"#b42318"}}>{error}</p>}
        {proofStatus && <p className="muted">{proofStatus}</p>}
        {txHash && <><p className="label">Funding transaction</p><pre>{txHash}</pre></>}
        {settlementTx && <><p className="label">Settlement transaction</p><pre>{settlementTx}</pre></>}
      </section>
      <section className="card">
        <h2>Commitment</h2>
        {!result ? <p className="muted">Nothing committed yet. The SDK canonicalizes the condition and derives the identifiers locally.</p> :
        <>
          <p className="label">Payment ID</p><pre>{result.paymentId}</pre>
          <p className="label">Condition hash</p><pre>{result.conditionHash}</pre>
          <p className="label">Exact proof context</p><pre>{result.proofContext}</pre>
          <p className="label">Canonical condition</p><pre>{JSON.stringify(condition,null,2)}</pre>
        </>}
      </section>
    </div>
  </main>;
}
