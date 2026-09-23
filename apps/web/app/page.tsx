"use client";

import { useMemo, useState } from "react";
import { prepareCreatePayment } from "@settleva/sdk";
import type { PaymentCondition } from "@settleva/conditions";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

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

  const condition = useMemo<PaymentCondition>(() => ({
    version:"1.0",provider,
    claims:[{field,operator:"equals",value}],
    expiresAt:Number(expiresAt)
  }),[provider,field,value,expiresAt]);

  function prepare() {
    setError("");
    setResult(null);
    try {
      const safePayer=(payer || ZERO) as `0x${string}`;
      const safePayee=(payee || ZERO) as `0x${string}`;
      const safeToken=(token || ZERO) as `0x${string}`;
      if (!payer || !payee || !token) throw new Error("Enter payer, payee and token addresses.");
      setResult(prepareCreatePayment({
        payer:safePayer,payee:safePayee,token:safeToken,amount,expiry:Number(expiresAt),condition
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not prepare payment.");
    }
  }

  return <main>
    <div style={{marginBottom:28}}>
      <div className="muted">SETTLEVA / REFERENCE CONSOLE</div>
      <h1 style={{fontSize:48,margin:"8px 0"}}>Condition → proof → settlement.</h1>
      <p className="muted" style={{maxWidth:700}}>Prepare an evidence-bound USDC payment without custody. The console shows the exact condition commitment and Reclaim context that a settlement contract will enforce.</p>
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
        <button style={{marginTop:20}} onClick={prepare}>Prepare commitment</button>
        {error && <p style={{color:"#b42318"}}>{error}</p>}
      </section>
      <section className="card">
        <h2>Commitment</h2>
        {!result ? <p className="muted">Nothing committed yet. The SDK will canonicalize the condition and derive the payment identifiers locally.</p> :
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
