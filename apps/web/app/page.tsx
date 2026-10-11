"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PLAYGROUND_SCENARIOS,
  createEvidenceText,
  createPolicyText,
  evaluatePlayground,
  getPlaygroundScenario,
  simulateNonQualifyingEvidence,
  type PlaygroundScenarioId
} from "../lib/playground-engine";

type RunResult = ReturnType<typeof evaluatePlayground>;
type Scenario = (typeof PLAYGROUND_SCENARIOS)[number];

const sdkExample = [
  'import { prepareCreatePayment } from "@settleva/sdk";',
  'import type { PaymentCondition } from "@settleva/conditions";',
  'import { parseUnits } from "viem";',
  'import { settlevaAbi } from "./contracts";',
  "",
  "// Assumes payer, payee, token, account, wallet and SETTLEVA_ADDRESS",
  "// are configured by your application before this flow runs.",
  "const condition: PaymentCondition = {",
  '  version: "1.0",',
  '  provider: "your-evidence-provider",',
  '  providerVersion: "1",',
  "  claims: [",
  '    { field: "milestone.status", operator: "equals", value: "accepted" }',
  "  ],",
  "  expiresAt: Math.floor(Date.now() / 1000) + 86_400",
  "};",
  "",
  "const payment = prepareCreatePayment({",
  "  payer, payee, token, amount: \"25\",",
  "  expiry: condition.expiresAt, condition",
  "});",
  "",
  "await wallet.writeContract({",
  "  account,",
  '  address: SETTLEVA_ADDRESS,',
  "  abi: settlevaAbi,",
  '  functionName: "createPayment",',
  "  args: [payment.paymentId, payee, token,",
  "    parseUnits(\"25\", 6), BigInt(condition.expiresAt),",
  "    payment.conditionHash, payment.providerHash]",
  "});"
].join("\n");

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    shield: "M12 3 20 6v5c0 5-3.5 8.2-8 10-4.5-1.8-8-5-8-10V6l8-3Z",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    code: "m8 8-4 4 4 4m8-8 4 4-4 4m-3-13-2 18",
    check: "m5 12 4 4L19 6",
    lock: "M6 10V7a6 6 0 0 1 12 0v3m-13 0h14v11H5V10Z",
    zap: "m13 2-3 9h7l-6 11 2-9H6l7-11Z",
    globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-10-10h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
    close: "m6 6 12 12M18 6 6 18",
    terminal: "m4 6 6 6-6 6m8 0h8",
    copy: "M8 8V4h12v12h-4M4 8h12v12H4V8Z",
    reset: "M4 11a8 8 0 1 1 2 6m-2-12v6h6"
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.zap} /></svg>;
}

function ScenarioGlyph({ id }: { id: string }) {
  const names: Record<string, string> = { gaming: "zap", freelance: "code", commerce: "lock", agents: "globe" };
  return <span className="scenario-glyph"><Icon name={names[id] || "shield"} size={22} /></span>;
}

export default function Home() {
  const [scenarioId, setScenarioId] = useState<PlaygroundScenarioId>("freelance");
  const [policyText, setPolicyText] = useState(() => createPolicyText("freelance"));
  const [evidenceText, setEvidenceText] = useState(() => createEvidenceText("freelance"));
  const [developerMode, setDeveloperMode] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [modalScenario, setModalScenario] = useState<Scenario | null>(null);
  const [copied, setCopied] = useState(false);
  const activeScenario = useMemo(() => getPlaygroundScenario(scenarioId), [scenarioId]);

  useEffect(() => {
    if (!modalScenario) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setModalScenario(null); };
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKeyDown); document.body.style.overflow = ""; };
  }, [modalScenario]);

  function chooseScenario(id: PlaygroundScenarioId) {
    setScenarioId(id);
    setPolicyText(createPolicyText(id));
    setEvidenceText(createEvidenceText(id));
    setRunResult(null);
  }

  function resetPlayground() {
    setPolicyText(createPolicyText(scenarioId));
    setEvidenceText(createEvidenceText(scenarioId));
    setRunResult(null);
  }

  function runSimulation() {
    setRunResult(evaluatePlayground(policyText, evidenceText));
  }

  function simulateMismatch() {
    try {
      setEvidenceText(simulateNonQualifyingEvidence(evidenceText));
      setRunResult(null);
    } catch (error) {
      setRunResult({ ok: false, error: error instanceof Error ? error.message : "Could not create a non-matching event." });
    }
  }

  async function copySdkExample() {
    try {
      await navigator.clipboard.writeText(sdkExample);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function tryScenario(id: PlaygroundScenarioId) {
    chooseScenario(id);
    setModalScenario(null);
    window.setTimeout(() => document.getElementById("playground")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const outcome = runResult === null
    ? { kind: "idle", title: "Awaiting simulation", text: "Run a scenario to evaluate the policy against its evidence." }
    : !runResult.ok
      ? { kind: "error", title: "Configuration error", text: runResult.error }
      : runResult.failures.length > 0
        ? { kind: "blocked", title: "Payment stays locked", text: runResult.failures.join("\n") }
        : { kind: "passed", title: "Policy conditions satisfied", text: "The sample evidence matches every configured claim. In production, a verified attestation and contract rules are still required before funds move." };

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Settleva home">
          <span className="brand-mark"><Icon name="shield" size={20} /></span>
          <span>settleva<span className="brand-period">.</span></span>
        </a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#use-cases">Use cases</a>
          <a href="#playground">Playground</a>
          <a href="#developers">Developers</a>
        </nav>
        <a className="topbar-cta" href="#playground">Try the playground <Icon name="arrow" size={16} /></a>
      </header>

      <section className="hero section-wrap" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> CONDITIONAL PAYMENTS INFRASTRUCTURE</div>
          <h1>Your rules.<br /><span>Your evidence.</span><br />Payments that follow through.</h1>
          <p className="hero-lede">Build applications where money moves only when the right conditions are proven. Settleva gives developers a reusable policy, evidence-verification and USDC settlement layer.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#playground">Explore the playground <Icon name="arrow" size={17} /></a>
            <a className="button button-secondary" href="#developers">Read the SDK example <Icon name="code" size={17} /></a>
          </div>
          <div className="hero-proof">
            <span><Icon name="check" size={15} /> Policy-bound payments</span>
            <span><Icon name="check" size={15} /> Evidence-first verification</span>
            <span><Icon name="check" size={15} /> Arc USDC settlement</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="Illustration of a condition being verified before settlement">
          <div className="visual-grid" />
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="visual-node node-policy"><span className="node-icon"><Icon name="code" size={19} /></span><div><small>01 / POLICY</small><strong>milestone.accepted</strong><em>must equal true</em></div><span className="node-state">DEFINED</span></div>
          <div className="visual-line line-one" />
          <div className="visual-node node-evidence"><span className="node-icon node-icon-cyan"><Icon name="shield" size={19} /></span><div><small>02 / EVIDENCE</small><strong>Acceptance verified</strong><em>provider · proof bound</em></div><span className="node-state node-state-cyan">VERIFIED</span></div>
          <div className="visual-line line-two" />
          <div className="visual-node node-settlement"><span className="node-icon node-icon-green"><Icon name="lock" size={19} /></span><div><small>03 / SETTLEMENT</small><strong>25.00 USDC</strong><em>release authorized</em></div><span className="settlement-pulse" /></div>
          <div className="visual-foot"><span className="live-dot" /> A condition is not a payment. It controls one.</div>
        </div>
        <div className="hero-bottomline"><span>DESIGNED FOR APP DEVELOPERS</span><span>POLICY → EVIDENCE → SETTLEMENT</span><span>BUILT FOR ARC</span></div>
      </section>

      <section className="statement-band">
        <div className="section-wrap statement-inner">
          <p>Stop rebuilding escrow logic every time your app needs a conditional payment.</p>
          <span>Define the policy once. Connect credible evidence. Reuse the settlement flow.</span>
        </div>
      </section>

      <section className="section-wrap section-block" id="how-it-works">
        <div className="section-heading">
          <div><div className="eyebrow">A SMALLER SURFACE AREA FOR MONEY</div><h2>Your application defines <span>the rule.</span></h2></div>
          <p>Settleva separates what should happen from how the payment is secured, verified and completed.</p>
        </div>
        <div className="steps-grid">
          <article className="step-card"><span className="step-number">01</span><div className="step-icon"><Icon name="code" size={22} /></div><h3>Commit the policy</h3><p>Define the claims that must be true before a payment may settle. The condition is canonicalized and hashed before funding.</p><span className="step-caption">POLICY HASH</span></article>
          <article className="step-card"><span className="step-number">02</span><div className="step-icon"><Icon name="shield" size={22} /></div><h3>Verify the evidence</h3><p>An appropriate provider supplies evidence. Settleva checks the provider, condition binding, verified claims and replay status.</p><span className="step-caption">EVIDENCE + CONTEXT</span></article>
          <article className="step-card"><span className="step-number">03</span><div className="step-icon"><Icon name="lock" size={22} /></div><h3>Protect the funds</h3><p>The Settleva contract holds USDC under a payment record and enforces expiry, authorization and one-time settlement.</p><span className="step-caption">ON-CHAIN ESCROW</span></article>
          <article className="step-card"><span className="step-number">04</span><div className="step-icon"><Icon name="zap" size={22} /></div><h3>Settle by the rule</h3><p>Funds are released only with valid settlement authorization. If the payment expires under the contract rules, eligible refunds remain available.</p><span className="step-caption">RELEASE OR REFUND</span></article>
        </div>
      </section>

      <section className="usecase-section" id="use-cases">
        <div className="section-wrap section-block">
          <div className="section-heading">
            <div><div className="eyebrow">ONE ENGINE · DIFFERENT POLICIES</div><h2>What will you <span>build with it?</span></h2></div>
            <p>Different products have different proof requirements. They can still use the same conditional settlement contract.</p>
          </div>
          <div className="usecase-grid">
            {PLAYGROUND_SCENARIOS.map((scenario, index) => (
              <button className={"usecase-card usecase-" + scenario.id} key={scenario.id} onClick={() => setModalScenario(scenario)} aria-haspopup="dialog">
                <div className="usecase-top"><span className="usecase-index">0{index + 1}</span><ScenarioGlyph id={scenario.id} /><span className="card-open"><Icon name="arrow" size={18} /></span></div>
                <div className="usecase-category">{scenario.category}</div>
                <h3>{scenario.title}</h3>
                <p>{scenario.description}</p>
                <div className="usecase-bottom"><span>View use case</span><span className="mini-arrow">↗</span></div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="playground-section" id="playground">
        <div className="section-wrap section-block">
          <div className="section-heading playground-heading">
            <div><div className="eyebrow"><span className="eyebrow-dot" /> INTERACTIVE POLICY PLAYGROUND</div><h2>Change the rule.<br /><span>See what breaks.</span></h2></div>
            <p>Explore a guided example or switch to developer mode to edit the policy and evidence payload. Run it, inspect failures and reset to a working example—no wallet required.</p>
          </div>
          <div className="playground-window">
            <div className="window-topbar">
              <div className="window-dots"><i /><i /><i /></div>
              <div className="window-title"><Icon name="terminal" size={15} /> SETTLEVA / POLICY LAB</div>
              <span className="window-badge">SIMULATION ONLY</span>
            </div>
            <div className="playground-toolbar">
              <div className="scenario-tabs" role="tablist" aria-label="Playground scenario">
                {PLAYGROUND_SCENARIOS.map((scenario) => <button key={scenario.id} role="tab" aria-selected={scenario.id === scenarioId} className={scenario.id === scenarioId ? "scenario-tab selected" : "scenario-tab"} onClick={() => chooseScenario(scenario.id)}>{scenario.title}</button>)}
              </div>
              <div className="mode-switch"><button className={!developerMode ? "mode-active" : ""} onClick={() => setDeveloperMode(false)}>Guided</button><button className={developerMode ? "mode-active" : ""} onClick={() => setDeveloperMode(true)}>Developer mode</button></div>
            </div>
            <div className="playground-main">
              <div className="editor-column">
                <div className="editor-intro"><div><span className="editor-step">A</span><div><strong>Payment policy</strong><small>{developerMode ? "Edit the actual condition schema" : "The condition Settleva will evaluate"}</small></div></div><span className="file-tag">policy.json</span></div>
                <textarea aria-label="Payment policy JSON" className="code-editor" spellCheck={false} readOnly={!developerMode} value={policyText} onChange={(event) => { setPolicyText(event.target.value); setRunResult(null); }} />
                <div className="editor-intro evidence-intro"><div><span className="editor-step editor-step-cyan">B</span><div><strong>Evidence claims</strong><small>{developerMode ? "Edit the sample provider output" : "What the demo evidence source reports"}</small></div></div><span className="file-tag file-tag-cyan">evidence.json</span></div>
                <textarea aria-label="Evidence claims JSON" className="code-editor evidence-editor" spellCheck={false} readOnly={!developerMode} value={evidenceText} onChange={(event) => { setEvidenceText(event.target.value); setRunResult(null); }} />
                {!developerMode && <p className="guided-note"><Icon name="lock" size={14} /> Demo event: <strong>{activeScenario.eventLabel}</strong>. Turn on developer mode to edit the policy or evidence.</p>}
                <div className="editor-actions"><button className="button button-muted" onClick={resetPlayground}><Icon name="reset" size={15} /> Reset</button><button className="button button-muted" onClick={simulateMismatch}>Simulate mismatch</button><button className="button button-run" onClick={runSimulation}><Icon name="zap" size={16} /> Run simulation <Icon name="arrow" size={15} /></button></div>
              </div>
              <div className="result-column">
                <div className="result-head"><div><span className="editor-step editor-step-green">C</span><div><strong>Evaluation trace</strong><small>Actual condition evaluator · local simulation</small></div></div><span className={"result-indicator " + outcome.kind}><i />{outcome.kind === "idle" ? "READY" : outcome.kind === "passed" ? "PASS" : outcome.kind === "blocked" ? "BLOCKED" : "ERROR"}</span></div>
                <div className={"outcome-card outcome-" + outcome.kind}><div className="outcome-icon"><Icon name={outcome.kind === "passed" ? "check" : outcome.kind === "blocked" ? "lock" : outcome.kind === "error" ? "close" : "terminal"} size={22} /></div><div><strong>{outcome.title}</strong><p>{outcome.text}</p></div></div>
                <div className="trace-list">
                  <div className="trace-row"><span className="trace-status trace-done"><Icon name="check" size={13} /></span><div><strong>Parse policy</strong><small>{runResult && !runResult.ok ? "Validation did not complete" : "JSON input"}</small></div><span className="trace-time">{runResult && !runResult.ok ? "ERROR" : runResult ? "OK" : "WAIT"}</span></div>
                  <div className="trace-row"><span className={"trace-status " + (runResult?.ok ? "trace-done" : "trace-wait")}>{runResult?.ok ? <Icon name="check" size={13} /> : "·"}</span><div><strong>Canonicalize condition</strong><small>Stable payment condition hash input</small></div><span className="trace-time">{runResult?.ok ? "OK" : "WAIT"}</span></div>
                  <div className="trace-row"><span className={"trace-status " + (runResult?.ok && runResult.failures.length === 0 ? "trace-done" : runResult?.ok ? "trace-fail" : "trace-wait")}>{runResult?.ok && runResult.failures.length === 0 ? <Icon name="check" size={13} /> : runResult?.ok ? <Icon name="close" size={13} /> : "·"}</span><div><strong>Evaluate claims</strong><small>Exact field + value comparison</small></div><span className="trace-time">{runResult?.ok ? runResult.failures.length === 0 ? "PASS" : "FAIL" : "WAIT"}</span></div>
                  <div className="trace-row"><span className="trace-status trace-wait">·</span><div><strong>Authorize settlement</strong><small>Requires backend verification + contract rules</small></div><span className="trace-time">NOT RUN</span></div>
                </div>
                {runResult?.ok && <div className="canonical-output"><label>CANONICAL POLICY</label><pre>{runResult.canonical}</pre></div>}
                <div className="result-disclaimer"><Icon name="shield" size={15} /><span>This sandbox does not verify an external provider, sign an attestation, connect a wallet or transfer USDC.</span></div>
              </div>
            </div>
          </div>
          <p className="playground-caption"><span className="live-dot" /> Powered by the same Settleva condition canonicalizer and evaluator used in the repository. External evidence and on-chain settlement are intentionally not simulated as real.</p>
        </div>
      </section>

      <section className="section-wrap section-block developer-section" id="developers">
        <div className="section-heading">
          <div><div className="eyebrow">FOR THE BUILDERS</div><h2>Integrate the rule.<br /><span>Keep your product.</span></h2></div>
          <p>Settleva is infrastructure, not another destination your users have to adopt. Add conditional payments to the app you already operate.</p>
        </div>
        <div className="developer-grid">
          <div className="developer-copy">
            <div className="dev-benefit"><span><Icon name="check" size={16} /></span><div><strong>Commit a deterministic condition</strong><p>Canonical policy data becomes a stable hash bound to the payment.</p></div></div>
            <div className="dev-benefit"><span><Icon name="check" size={16} /></span><div><strong>Keep proof handling server-side</strong><p>Evidence verification and replay protection stay out of the browser.</p></div></div>
            <div className="dev-benefit"><span><Icon name="check" size={16} /></span><div><strong>Settle on Arc</strong><p>The shared contract holds USDC and enforces the authorized payment transition.</p></div></div>
            <a className="inline-link" href="https://github.com/Investorquab/Settleva" target="_blank" rel="noreferrer">Explore the repository <Icon name="arrow" size={16} /></a>
          </div>
          <div className="sdk-panel">
            <div className="sdk-panel-head"><div><span className="window-file-icon"><Icon name="code" size={15} /></span><strong>conditional-payment.ts</strong></div><button onClick={() => void copySdkExample()}><Icon name="copy" size={15} /> {copied ? "Copied" : "Copy code"}</button></div>
            <pre className="sdk-code"><code>{sdkExample}</code></pre>
            <div className="sdk-panel-foot"><span><span className="live-dot" /> TypeScript</span><span>SDK API shown from current source</span></div>
          </div>
        </div>
      </section>

      <section className="trust-section">
        <div className="section-wrap trust-inner">
          <div><div className="eyebrow">SECURITY IS PART OF THE FLOW</div><h2>Evidence is not<br /><span>just a boolean.</span></h2><p>A successful API response alone is not a cryptographic proof. Settleva binds verified claims to the committed condition and payment before the contract accepts settlement authorization.</p></div>
          <div className="trust-points">
            <div><span>01</span><div><strong>Condition binding</strong><p>Evidence is checked against the condition committed at funding time.</p></div></div>
            <div><span>02</span><div><strong>Replay protection</strong><p>Proof identifiers and verification sessions cannot authorize duplicate settlement.</p></div></div>
            <div><span>03</span><div><strong>Explicit trust boundary</strong><p>The current release flow relies on a backend verification signer. It is not presented as trustless on-chain proof verification.</p></div></div>
            <div><span>04</span><div><strong>Expiry-aware escrow</strong><p>Contract state controls release eligibility and refund timing.</p></div></div>
          </div>
        </div>
      </section>

      <section className="final-cta section-wrap">
        <div className="final-cta-card"><div className="eyebrow">BUILD CONDITIONAL PAYMENTS</div><h2>Define the condition.<br /><span>Let settlement follow.</span></h2><p>Start with the playground, inspect the SDK and see how policies become payment commitments.</p><div className="hero-actions"><a className="button button-primary" href="#playground">Try Settleva <Icon name="arrow" size={17} /></a><a className="button button-secondary" href="https://github.com/Investorquab/Settleva" target="_blank" rel="noreferrer">View on GitHub <Icon name="arrow" size={17} /></a></div></div>
      </section>

      <footer className="footer section-wrap"><a className="brand" href="#top"><span className="brand-mark"><Icon name="shield" size={18} /></span><span>settleva<span className="brand-period">.</span></span></a><p>Conditional settlement infrastructure for developers.</p><div><a href="#use-cases">Use cases</a><a href="#playground">Playground</a><a href="#developers">SDK</a><a href="https://github.com/Investorquab/Settleva" target="_blank" rel="noreferrer">GitHub ↗</a></div><span className="footer-end">POLICY → PROOF → PAYMENT</span></footer>

      {modalScenario && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalScenario(null); }}><section className="usecase-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" onClick={() => setModalScenario(null)} aria-label="Close use case"><Icon name="close" size={20} /></button><div className="modal-overline"><ScenarioGlyph id={modalScenario.id} /><span>{modalScenario.category} · USE CASE 0{PLAYGROUND_SCENARIOS.findIndex((item) => item.id === modalScenario.id) + 1}</span></div><h2 id="modal-title">{modalScenario.title}</h2><p className="modal-description">{modalScenario.description}</p><div className="modal-flow"><div><small>THE POLICY</small><strong>Define the condition</strong><p>Choose the claims that must match before the payment can settle.</p></div><div><small>THE EVIDENCE</small><strong>Verify what happened</strong><p>An appropriate source must supply evidence that is bound to this payment's condition.</p></div><div><small>THE OUTCOME</small><strong>Release or stay locked</strong><p>The contract enforces settlement authorization. The browser demo never moves funds.</p></div></div><div className="modal-policy"><label>EXAMPLE CONDITION CLAIMS</label><pre>{JSON.stringify(modalScenario.policy.claims, null, 2)}</pre></div><button className="button button-primary modal-try" onClick={() => tryScenario(modalScenario.id)}><Icon name="terminal" size={17} /> Try this scenario <Icon name="arrow" size={16} /></button></section></div>}
    </main>
  );
}
