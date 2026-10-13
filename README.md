# Settleva

**Settleva is developer infrastructure for policy-based, evidence-driven USDC settlement on Arc.**

Define the condition in code. Let your application verify the outcome. Settle the payment on-chain.

## Product model

Settleva consists of a reusable SDK, a settlement contract implementation, a condition engine and verification integration boundaries. Developers integrate these components into their own products. The website demonstrates the developer workflow; it is not a hosted escrow dashboard that developers must use.

Each integrator can deploy its own instance of the same Settleva.sol code and choose its own verificationSigner. The integrator controls its deployment and verifier keys, keeping private keys server-side. Using Settleva must not require trusting a verifier key controlled by the Settleva team.

Each payment carries its own payer, payee, USDC amount, expiry, condition hash, provider hash and lifecycle state. Developers do not redeploy for every escrow: they create each new payment through a contract transaction. Existing funded-payment terms cannot currently be edited in place. Changing contract code or the current deployment's immutable verifier requires a replacement deployment.

## Four demonstration scenarios

- Gaming rewards
- Freelance milestones
- Conditional commerce
- Agentic economy

These are four policy examples over the same settlement primitives, not four separate contracts and not four claims of live evidence integration. The homepage playground evaluates sample policies against sample evidence locally. It does not connect a wallet, create a real escrow, cryptographically verify a source, sign an attestation or transfer USDC.

## SDK distribution status

The SDK and its condition-engine dependency are prepared for public npm publication, but they are not installable from npm until the package owner publishes them and verifies a clean consumer installation. The release workflow is [.github/workflows/publish-npm.yml](.github/workflows/publish-npm.yml).

For the first release, add an npm publish token as the GitHub Actions repository secret `NPM_TOKEN`, then run **Actions → Publish npm packages** on `main` and explicitly set `publish_now` to true. The workflow runs the repository checks, tests and builds, creates package tarballs, confirms that the SDK does not retain a `workspace:` dependency, and publishes `@settleva/conditions` before `@settleva/sdk`.

After the first successful publication, configure npm Trusted Publishing separately for both packages: provider **GitHub Actions**, owner **Investorquab**, repository **Settleva**, workflow **publish-npm.yml**, environment **npm-publish**. Then remove `NPM_TOKEN`; subsequent publishes can use short-lived GitHub OIDC credentials. Follow the instructions in [the SDK README](packages/sdk/README.md). Do not describe the npm release as complete until both registry pages and a fresh consumer install have been verified.

## Verification and future work

The base SDK does not mandate Reclaim. The core protocol needs an authoritative evidence source and a verifier selected by the integrator. A source-signed server integration boundary exists in the repository, but it is not a ready-made integration for every game, marketplace, commerce service or agent orchestrator; each real source still needs implementation and validation.

Reclaim/GitHub deployment proof is deferred to [Future Integrations: Reclaim](future-integrations/reclaim/README.md). The earlier code, tests, SQL schemas and provider notes are preserved there for judges and future continuation. It is not a prerequisite for the four website demonstrations or for importing the base SDK.

## Repository map

- apps/web: approved landing page and local scenario playground.
- packages/sdk: payment preparation, amount conversion, attestation hashing and viem contract-call builders.
- packages/conditions: condition schema, canonicalization, hashing and deterministic evaluation.
- packages/providers: provider integration utilities.
- packages/verification: verification types and persistent replay protection.
- contracts: reusable Solidity implementation and tests.
- future-integrations/reclaim: deferred Reclaim proof work, SQL schemas, source snapshots, findings and next steps.
- docs: architecture, security, Arc compatibility and deployment notes.

## Development checks

Requirements: Node.js 22+, pnpm 10.15.0, and Circle's Arc Foundry for Arc-specific Solidity testing.

From the repository root:

    pnpm install --frozen-lockfile
    pnpm check
    pnpm test
    pnpm build

From contracts/ in Ubuntu/WSL with Arc Foundry installed:

    FOUNDRY_PROFILE=arc arc-forge build --sizes
    FOUNDRY_PROFILE=arc arc-forge test -vvv

## Security and scope

Never place private keys, provider secrets, database credentials or signing secrets in browser code, public environment variables, the repository or chat. A private key is not required by the SDK and must not be accepted by a frontend integration.

Do not treat a successful API response, client-supplied boolean, mock event or playground result as proof. Before claiming a use case is production-enabled, validate its authoritative source, condition-to-payment binding and replay protection, then complete a real Arc USDC funding → verified evidence → attestation → release test. Green CI and a deployed website do not prove that a real settlement has succeeded.
