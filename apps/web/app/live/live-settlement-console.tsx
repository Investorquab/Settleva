"use client";

import { useEffect, useRef, useState } from "react";
import {
  ARC_EXPLORER_URL,
  ARC_MAINNET_CHAIN_ID,
  ARC_MAINNET_RPC_URL,
  ARC_USDC_ADDRESS,
  ARC_USDC_DECIMALS,
  SETTLEVA_ABI,
  buildApprovalCall,
  buildCreatePaymentCall,
  buildRefundPaymentCall,
  buildReleasePaymentCall,
  prepareCreatePayment
} from "@settleva/sdk";
import { buildGitHubDeploymentCondition } from "@settleva/providers";
import type { PaymentCondition } from "@settleva/conditions";
import { ReclaimProofRequest } from "@reclaimprotocol/js-sdk";
import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  getAddress,
  http,
  isAddress,
  type Address,
  type Hex
} from "viem";
import styles from "./live.module.css";

type InjectedProvider = {
  request(args: {method: string; params?: readonly unknown[] | object}): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: InjectedProvider;
  }
}

const ARC_CHAIN = defineChain({
  id: ARC_MAINNET_CHAIN_ID,
  name: "Arc",
  nativeCurrency: {name: "USDC", symbol: "USDC", decimals: 18},
  rpcUrls: {default: {http: [ARC_MAINNET_RPC_URL]}},
  blockExplorers: {default: {name: "Arc Explorer", url: ARC_EXPLORER_URL}}
});

const erc20Abi = [
  {type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{name: "", type: "uint8"}]}
] as const;

type Phase = "idle" | "funding" | "funded" | "proving" | "verified" | "releasing" | "released" | "refunding" | "refunded" | "error";

interface LiveSettlement {
  readonly payer: Address;
  readonly payee: Address;
  readonly amount: string;
  readonly expiry: number;
  readonly paymentId: Hex;
  readonly conditionHash: Hex;
  readonly condition: PaymentCondition;
  readonly proofContext: string;
  readonly sessionId?: string;
  readonly statusToken?: string;
  readonly requestJson?: string;
  readonly approvalTx: Hex;
  readonly fundingTx: Hex;
  readonly proofIdentifier?: Hex;
  readonly verificationSignature?: Hex;
  readonly releaseTx?: Hex;
  readonly refundTx?: Hex;
}

interface ProviderStatus {
  readonly status?: "pending" | "verified" | "failed";
  readonly error?: string;
  readonly proofIdentifier?: string;
  readonly verificationSignature?: string;
}

function contractAddress(): Address {
  const value = process.env.NEXT_PUBLIC_SETTLEVA_ADDRESS;
  if (!value || !isAddress(value) || value.toLowerCase() === "0x0000000000000000000000000000000000000000") {
    throw new Error("The deployed Settleva address is not configured. Set NEXT_PUBLIC_SETTLEVA_ADDRESS after deployment.");
  }
  return getAddress(value);
}

async function connectArcWallet() {
  if (!window.ethereum) throw new Error("No EVM wallet was found. Install or open a wallet such as MetaMask.");
  const chainClient = createWalletClient({chain: ARC_CHAIN, transport: custom(window.ethereum as never)});
  let chainId = await chainClient.getChainId();
  if (chainId !== ARC_MAINNET_CHAIN_ID) {
    try {
      await chainClient.switchChain({id: ARC_MAINNET_CHAIN_ID});
    } catch {
      await chainClient.addChain({chain: ARC_CHAIN});
      await chainClient.switchChain({id: ARC_MAINNET_CHAIN_ID});
    }
    chainId = await chainClient.getChainId();
  }
  if (chainId !== ARC_MAINNET_CHAIN_ID) throw new Error("Switch your wallet to Arc mainnet (chain ID 5042).");
  const accounts = await window.ethereum.request({method: "eth_requestAccounts"});
  if (!Array.isArray(accounts) || typeof accounts[0] !== "string" || !isAddress(accounts[0])) {
    throw new Error("Your wallet did not return a usable EVM account.");
  }
  const account = getAddress(accounts[0]);
  const wallet = createWalletClient({account, chain: ARC_CHAIN, transport: custom(window.ethereum as never)});
  return {account, wallet};
}

function txUrl(hash?: Hex) {
  return hash ? ARC_EXPLORER_URL + "/tx/" + hash : undefined;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function LiveSettlementConsole() {
  const [repository, setRepository] = useState(process.env.NEXT_PUBLIC_GITHUB_REPOSITORY || "Investorquab/Settleva");
  const [deploymentRef, setDeploymentRef] = useState("main");
  const [commitSha, setCommitSha] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [expectedStatus, setExpectedStatus] = useState("success");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("Connect a wallet on Arc mainnet to create a real escrow.");
  const [settlement, setSettlement] = useState<LiveSettlement | null>(null);
  const reclaimRequestRef = useRef<ReclaimProofRequest | null>(null);
  const contract = process.env.NEXT_PUBLIC_SETTLEVA_ADDRESS;
  const providerId = process.env.NEXT_PUBLIC_RECLAIM_PROVIDER_ID;
  const providerVersion = process.env.NEXT_PUBLIC_RECLAIM_PROVIDER_VERSION;
  const configReady = Boolean(
    contract && isAddress(contract) && contract.toLowerCase() !== "0x0000000000000000000000000000000000000000"
    && providerId && !/your_published_provider_id|placeholder/i.test(providerId)
    && providerVersion && !/your_published_provider_version|placeholder/i.test(providerVersion)
  );
  const canRefund = Boolean(settlement && now >= settlement.expiry * 1000 && !settlement.releaseTx && !settlement.refundTx);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function resetForAnotherPayment() {
    setSettlement(null);
    reclaimRequestRef.current = null;
    setPhase("idle");
    setMessage("Ready to create another Arc USDC escrow.");
  }

  async function createReclaimSession(current: LiveSettlement) {
    const response = await fetch("/api/reclaim/request", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      cache: "no-store",
      body: JSON.stringify({context: current.proofContext, condition: current.condition})
    });
    const body = await response.json() as {
      error?: string; request?: string; sessionId?: string; statusToken?: string;
    };
    if (!response.ok || !body.request || !body.sessionId || !body.statusToken) {
      throw new Error(body.error || "The backend could not create a Reclaim proof request.");
    }
    const request = await ReclaimProofRequest.fromJsonString(body.request);
    reclaimRequestRef.current = request;
    const next: LiveSettlement = {
      ...current,
      sessionId: body.sessionId,
      statusToken: body.statusToken,
      requestJson: body.request,
      proofIdentifier: undefined,
      verificationSignature: undefined
    };
    setSettlement(next);
    return next;
  }

  async function createEscrow() {
    if (busy) return;
    setBusy(true);
    setPhase("funding");
    setMessage("Connecting to Arc and checking the deployed contract…");
    reclaimRequestRef.current = null;
    let fundedSettlement: LiveSettlement | null = null;
    try {
      if (settlement && phase !== "released" && phase !== "refunded") {
        throw new Error("This payment is already funded. Continue verification/release or refund it after expiry rather than creating a duplicate escrow.");
      }
      if (!providerId || !providerVersion || /your_published_provider_id|placeholder/i.test(providerId)
        || /your_published_provider_version|placeholder/i.test(providerVersion)) {
        throw new Error("A real published Reclaim provider ID and exact version are required before funding.");
      }
      const targetContract = contractAddress();
      const {account, wallet} = await connectArcWallet();
      if (payee.trim() && !isAddress(payee.trim())) throw new Error("Payee must be a valid EVM address.");
      const targetPayee = payee.trim() ? getAddress(payee.trim()) : account;
      const publicClient = createPublicClient({chain: ARC_CHAIN, transport: http(ARC_MAINNET_RPC_URL)});
      const [deployedToken, decimals] = await Promise.all([
        publicClient.readContract({address: targetContract, abi: SETTLEVA_ABI, functionName: "ARC_USDC"}),
        publicClient.readContract({address: ARC_USDC_ADDRESS, abi: erc20Abi, functionName: "decimals"})
      ]);
      if (getAddress(deployedToken) !== getAddress(ARC_USDC_ADDRESS)) {
        throw new Error("The deployed contract does not enforce the canonical Arc USDC token.");
      }
      if (decimals !== ARC_USDC_DECIMALS) throw new Error("Arc USDC ERC-20 decimals were not six.");

      const expiry = Math.floor(Date.now() / 1000) + 60 * 60;
      const condition = buildGitHubDeploymentCondition({
        provider: providerId,
        providerVersion,
        repository: repository.trim(),
        ref: deploymentRef.trim(),
        sha: commitSha.trim(),
        environment: environment.trim(),
        status: expectedStatus.trim(),
        expiresAt: expiry
      });
      const prepared = prepareCreatePayment({
        payer: account,
        payee: targetPayee,
        token: ARC_USDC_ADDRESS,
        amount: amount.trim(),
        expiry,
        condition
      });

      setMessage("Approve the exact USDC amount in your wallet…");
      const approvalCall = buildApprovalCall(prepared, targetContract, ARC_USDC_DECIMALS);
      const approvalTx = await wallet.writeContract({...approvalCall, account});
      const approvalReceipt = await publicClient.waitForTransactionReceipt({hash: approvalTx});
      if (approvalReceipt.status !== "success") throw new Error("USDC approval transaction reverted.");

      setMessage("USDC allowance confirmed. Confirm the escrow funding transaction…");
      const fundingCall = buildCreatePaymentCall(prepared, targetContract, ARC_USDC_DECIMALS);
      const fundingTx = await wallet.writeContract({...fundingCall, account});
      const fundingReceipt = await publicClient.waitForTransactionReceipt({hash: fundingTx});
      if (fundingReceipt.status !== "success") throw new Error("Escrow funding transaction reverted.");

      fundedSettlement = {
        payer: account,
        payee: targetPayee,
        amount: prepared.request.amount,
        expiry,
        paymentId: prepared.paymentId,
        conditionHash: prepared.conditionHash,
        condition,
        proofContext: prepared.proofContext,
        approvalTx,
        fundingTx
      };
      setSettlement(fundedSettlement);
      setPhase("funded");
      setMessage("Escrow funded on Arc. The contract locks the USDC until a valid attestation releases it or the payer refunds after expiry.");

      try {
        await createReclaimSession(fundedSettlement);
        setMessage("Escrow funded and a payment-bound Reclaim request is ready. Start proof generation next.");
      } catch (error) {
        setPhase("error");
        setMessage("The escrow is already funded, but Reclaim request setup failed: " +
          (error instanceof Error ? error.message : "unknown error") +
          " You can retry proof setup below; do not create a second payment.");
      }
    } catch (error) {
      setPhase("error");
      const reason = error instanceof Error ? error.message : "Could not fund Settleva escrow.";
      setMessage(fundedSettlement
        ? "Funds are already locked in the contract. " + reason + " Use the existing payment's proof retry or post-expiry refund controls."
        : reason);
    } finally {
      setBusy(false);
    }
  }

  async function retryReclaimSetup() {
    if (!settlement || busy || settlement.releaseTx || settlement.refundTx) return;
    setBusy(true);
    setPhase("funded");
    setMessage("Creating a fresh proof session for the existing funded payment…");
    try {
      await createReclaimSession(settlement);
      setPhase("funded");
      setMessage("Fresh Reclaim request created for the same on-chain payment. No duplicate escrow was created.");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Could not create a fresh Reclaim request.");
    } finally {
      setBusy(false);
    }
  }

  async function generateProofAndWait() {
    if (!settlement?.sessionId || !settlement.statusToken || !settlement.requestJson || busy || !reclaimRequestRef.current) return;
    setBusy(true);
    setPhase("proving");
    setMessage("Opening the Reclaim verification flow. Complete the provider prompts in the opened tab/window…");
    try {
      await reclaimRequestRef.current.triggerReclaimFlow({verificationMode: "portal"});
      setMessage("Waiting for the server-side callback to verify proof signatures, app-secret TEE/session binding, freshness, exact claims and replay protection…");
      for (let attempt = 0; attempt < 200; attempt += 1) {
        await wait(3000);
        const response = await fetch("/api/reclaim/status", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          cache: "no-store",
          body: JSON.stringify({sessionId: settlement.sessionId, statusToken: settlement.statusToken})
        });
        let body: ProviderStatus;
        try {
          body = await response.json() as ProviderStatus;
        } catch {
          throw new Error("The verification API returned an unreadable response.");
        }
        if (!response.ok) {
          if ([502, 503, 504].includes(response.status)) {
            setMessage("Proof verification service is temporarily unavailable; waiting to retry… " + (attempt + 1) + "/200");
            continue;
          }
          throw new Error(body.error || "Could not read the private proof session status.");
        }
        if (body.status === "failed") throw new Error(body.error || "The evidence did not satisfy the committed policy.");
        if (body.status === "verified") {
          if (!body.proofIdentifier || !body.verificationSignature) {
            throw new Error("The verification record is missing its payment-bound release attestation.");
          }
          setSettlement({...settlement, proofIdentifier: body.proofIdentifier as Hex, verificationSignature: body.verificationSignature as Hex});
          setPhase("verified");
          setMessage("Proof verified and the signed attestation is saved. Only the designated payee can now release before expiry.");
          return;
        }
        setMessage("Waiting for a fresh Reclaim proof… " + (attempt + 1) + "/200");
      }
      throw new Error("Proof wait timed out. Check the current on-chain payment before retrying; do not create another escrow.");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "Reclaim proof flow failed.");
    } finally {
      setBusy(false);
    }
  }

  async function releaseToPayee() {
    if (!settlement?.proofIdentifier || !settlement.verificationSignature || busy) return;
    setBusy(true);
    setPhase("releasing");
    setMessage("Connect or switch your wallet to the exact payee account to release the payment…");
    try {
      if (Date.now() >= settlement.expiry * 1000) throw new Error("This escrow has expired. The payee can no longer release it; the payer can refund it.");
      const targetContract = contractAddress();
      const {account, wallet} = await connectArcWallet();
      if (account.toLowerCase() !== settlement.payee.toLowerCase()) {
        throw new Error("Connected wallet is not the payment's payee. Switch to " + settlement.payee + " to release.");
      }
      const call = buildReleasePaymentCall({
        settlevaAddress: targetContract,
        paymentId: settlement.paymentId,
        proofIdentifier: settlement.proofIdentifier,
        verificationSignature: settlement.verificationSignature
      });
      const tx = await wallet.writeContract({...call, account});
      const publicClient = createPublicClient({chain: ARC_CHAIN, transport: http(ARC_MAINNET_RPC_URL)});
      const receipt = await publicClient.waitForTransactionReceipt({hash: tx});
      if (receipt.status !== "success") throw new Error("Settleva release transaction reverted.");
      const payment = await publicClient.readContract({
        address: targetContract,
        abi: SETTLEVA_ABI,
        functionName: "payments",
        args: [settlement.paymentId]
      });
      if (payment[7] !== 2) throw new Error("Release receipt succeeded but on-chain payment status is not Released.");
      setSettlement({...settlement, releaseTx: tx});
      setPhase("released");
      setMessage("Release confirmed on Arc mainnet. The on-chain payment is in Released state.");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "The payee could not release escrow.");
    } finally {
      setBusy(false);
    }
  }

  async function refundAfterExpiry() {
    if (!settlement || busy) return;
    setBusy(true);
    setPhase("refunding");
    setMessage("Checking expiry and connecting to the original payer wallet…");
    try {
      if (Date.now() < settlement.expiry * 1000) throw new Error("Refund is available only after the committed expiry.");
      const targetContract = contractAddress();
      const {account, wallet} = await connectArcWallet();
      if (account.toLowerCase() !== settlement.payer.toLowerCase()) {
        throw new Error("Only the original payer can refund. Switch to " + settlement.payer + ".");
      }
      const call = buildRefundPaymentCall({settlevaAddress: targetContract, paymentId: settlement.paymentId});
      const tx = await wallet.writeContract({...call, account});
      const publicClient = createPublicClient({chain: ARC_CHAIN, transport: http(ARC_MAINNET_RPC_URL)});
      const receipt = await publicClient.waitForTransactionReceipt({hash: tx});
      if (receipt.status !== "success") throw new Error("Settleva refund transaction reverted.");
      const payment = await publicClient.readContract({
        address: targetContract,
        abi: SETTLEVA_ABI,
        functionName: "payments",
        args: [settlement.paymentId]
      });
      if (payment[7] !== 3) throw new Error("Refund receipt succeeded but on-chain payment status is not Refunded.");
      setSettlement({...settlement, refundTx: tx});
      setPhase("refunded");
      setMessage("Refund confirmed on Arc mainnet. The payer recovered the escrow after expiry.");
    } catch (error) {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "The payer could not refund escrow.");
    } finally {
      setBusy(false);
    }
  }

  const active = Boolean(settlement && !["released","refunded"].includes(phase));
  const statusDotClass = [styles.statusDot, phase === "error" ? styles.statusDotError : phase === "released" ? styles.statusDotSuccess : ""].filter(Boolean).join(" ");
  const canRetryProofSetup = Boolean(settlement && !settlement.verificationSignature && !settlement.releaseTx && !settlement.refundTx && (phase === "error" || !settlement.sessionId));

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <a className={styles.brand} href="/">Settleva<span>.</span></a>
        <span className={styles.network}><i /> ARC MAINNET · 5042</span>
      </header>
      <section className={styles.intro}>
        <p className={styles.eyebrow}>LIVE SETTLEMENT · NOT A SIMULATION</p>
        <h1>Evidence first.<br/><span>USDC follows.</span></h1>
        <p className={styles.lede}>Create a real Arc USDC escrow, verify fresh GitHub deployment-status evidence through Reclaim, then release funds to the designated payee.</p>
      </section>
      <section className={styles.grid}>
        <form className={styles.form} onSubmit={(event) => {event.preventDefault(); void createEscrow();}}>
          <div className={styles.sectionHead}><span>01</span><div><h2>Define the condition</h2><p>These exact values are committed before funding.</p></div></div>
          <label>GitHub repository <input required value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="owner/repository" pattern="[^/]+/[^/]+" /></label>
          <div className={styles.twoCols}>
            <label>Deployment ref <input required value={deploymentRef} onChange={(event) => setDeploymentRef(event.target.value)} placeholder="main" /></label>
            <label>Environment <input required value={environment} onChange={(event) => setEnvironment(event.target.value)} placeholder="production" /></label>
          </div>
          <label>Expected deployment commit SHA <input required value={commitSha} onChange={(event) => setCommitSha(event.target.value)} placeholder="40-character Git commit SHA" pattern="[a-fA-F0-9]{40}" minLength={40} maxLength={40} /></label>
          <label>Required deployment status <input required value={expectedStatus} onChange={(event) => setExpectedStatus(event.target.value)} placeholder="success" /></label>
          <div className={styles.sectionHead}><span>02</span><div><h2>Fund the escrow</h2><p>ERC-20 USDC uses six decimals; Arc native USDC pays gas using eighteen.</p></div></div>
          <label>Payee address <input value={payee} onChange={(event) => setPayee(event.target.value)} placeholder="Leave empty to use the connected wallet" /></label>
          <label>Amount (USDC) <input required value={amount} onChange={(event) => setAmount(event.target.value)} pattern="[0-9]+(\.[0-9]+)?" inputMode="decimal" /></label>
          <button className={styles.primary} type="submit" disabled={busy || !configReady || Boolean(settlement)}>{busy && phase === "funding" ? "Waiting for wallet…" : active ? "Escrow already active" : "Approve & fund on Arc"}</button>
          {!configReady && <p className={styles.warning}>Configuration gate: deploy Settleva and configure the real contract address plus a published Reclaim provider ID/version before the live flow can run.</p>}
          <p className={styles.fineprint}>You sign the approval and funding transactions in your wallet. Settleva never asks for your private key.</p>
        </form>
        <aside className={styles.statusPanel}>
          <div className={styles.sectionHead}><span>03</span><div><h2>Verify, then release</h2><p>No release attestation is accepted until proof, context, freshness, claims and replay checks pass.</p></div></div>
          <div className={styles.statusLine}><span className={statusDotClass} /><strong>{phase.toUpperCase()}</strong></div>
          <p aria-live="polite" className={phase === "error" ? styles.error : styles.message}>{message}</p>
          {settlement && !settlement.releaseTx && !settlement.refundTx && <>
            {canRetryProofSetup && <button type="button" className={styles.secondary} onClick={() => void retryReclaimSetup()} disabled={busy}>Retry proof setup for this escrow</button>}
            <button type="button" className={styles.secondary} onClick={() => void generateProofAndWait()} disabled={!settlement.requestJson || !settlement.sessionId || busy || Boolean(settlement.verificationSignature)}>Start Reclaim proof</button>
            <button type="button" className={styles.primary} onClick={() => void releaseToPayee()} disabled={!settlement.verificationSignature || busy || Date.now() >= settlement.expiry * 1000}>Release to payee</button>
            {canRefund && <button type="button" className={styles.secondary} onClick={() => void refundAfterExpiry()} disabled={busy}>Refund expired escrow to payer</button>}
          </>}
          {settlement && <div className={styles.details}>
            <div><span>Payment ID</span><code>{settlement.paymentId}</code></div>
            <div><span>Policy hash</span><code>{settlement.conditionHash}</code></div>
            <div><span>Payer</span><code>{settlement.payer}</code></div>
            <div><span>Payee</span><code>{settlement.payee}</code></div>
            <div><span>Amount</span><strong>{settlement.amount} USDC</strong></div>
            <div><span>Expires</span><strong>{new Date(settlement.expiry * 1000).toLocaleString()}</strong></div>
            {settlement.approvalTx && <div><span>Approval</span><a target="_blank" rel="noreferrer" href={txUrl(settlement.approvalTx)}>View on Arc Explorer ↗</a></div>}
            {settlement.fundingTx && <div><span>Funding</span><a target="_blank" rel="noreferrer" href={txUrl(settlement.fundingTx)}>View on Arc Explorer ↗</a></div>}
            {settlement.releaseTx && <div><span>Release</span><a target="_blank" rel="noreferrer" href={txUrl(settlement.releaseTx)}>View on Arc Explorer ↗</a></div>}
            {settlement.refundTx && <div><span>Refund</span><a target="_blank" rel="noreferrer" href={txUrl(settlement.refundTx)}>View on Arc Explorer ↗</a></div>}
          </div>}
          {phase === "released" && <div className={styles.success}>Verified on-chain: release receipt confirmed and payment state equals Released.</div>}
          {phase === "refunded" && <div className={styles.success}>Verified on-chain: refund receipt confirmed and payment state equals Refunded.</div>}
          {(phase === "released" || phase === "refunded") && <button type="button" className={styles.secondary} onClick={resetForAnotherPayment}>Start another settlement</button>}
        </aside>
      </section>
      <footer className={styles.footer}>
        <p><strong>Security boundary:</strong> Reclaim proof verification and policy evaluation happen server-side. The contract trusts a dedicated immutable verifier signer; this is backend-attested settlement, not trustless on-chain Reclaim verification.</p>
        <div><a href="/">Back to Settleva overview</a><span>Arc mainnet · USDC · Reclaim</span></div>
      </footer>
    </main>
  );
}
