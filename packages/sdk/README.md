# @settleva/sdk

The Settleva SDK is developer infrastructure for conditional USDC settlement on Arc. It prepares payment commitments and typed contract calls; it does not custody funds, sign user transactions, or decide whether external evidence is true.

## Package status and installation

The package metadata and release workflow are ready, but npm installation is not available until the package owner publishes both `@settleva/conditions` and `@settleva/sdk`. The conditions package must be published first because the SDK depends on it. Do not copy an unpublished install command into a production integration and assume it works.

After publication is verified, install into an existing application:

    pnpm add @settleva/sdk
    # or: npm install @settleva/sdk

The integration does not require the Settleva website. The application chooses its own wallet connector, contract address and verification backend.

## Create a payment

    import {
      buildApprovalCall,
      buildCreatePaymentCall,
      prepareCreatePayment
    } from "@settleva/sdk";
    import type { PaymentCondition } from "@settleva/sdk";

    const expiresAt = Math.floor(Date.now() / 1000) + 86_400;
    const condition: PaymentCondition = {
      version: "1.0",
      provider: "your-source-provider",
      providerVersion: "1",
      claims: [
        { field: "milestone.status", operator: "equals", value: "accepted" }
      ],
      expiresAt
    };

    const prepared = prepareCreatePayment({
      payer, payee, token: arcUsdcAddress, amount: "25",
      expiry: expiresAt, condition
    });

    // Use your own wallet client and your own deployed contract address.
    // The wallet client signs; the SDK never receives the private key.
    const approvalCall = buildApprovalCall(prepared, settlevaAddress, 6);
    await walletClient.writeContract({ account, ...approvalCall });

    const fundingCall = buildCreatePaymentCall(prepared, settlevaAddress, 6);
    await walletClient.writeContract({ account, ...fundingCall });

Wait for transaction receipts before treating approval or funding as complete. Arc USDC ERC-20 amounts use six decimals. The SDK validates inputs and builds calls; it does not deploy a contract, connect a wallet, custody funds, verify evidence or sign an attestation.

## Integrator-controlled deployment

Each integrator can deploy the same Settleva.sol code as its own instance and choose its own verificationSigner at construction. Keep the deployment key and the backend verifier key separate. The verifier private key belongs only in that integrator's trusted server-side secret manager; never embed it in browser code or the SDK.

The verifier address is immutable for that contract instance. Changing it requires a replacement deployment. This does not mean redeploying for every escrow: every call to createPayment records a separate payment with its own payee, amount, expiry, condition hash and provider hash.

A funded payment's terms cannot currently be edited in place. If a product needs amendment or cancellation before expiry, that requires an explicit contract operation and security review. Do not assume the current contract supports editing.

See the contract deployment and trust-boundary guide in contracts/README.md.

## Evidence integrations

The condition engine currently supports exact equality (equals). A real settlement needs an authoritative source and a verifier that validates the outcome, binds it to the funded payment, prevents replay, and signs an attestation accepted by that deployment's contract.

The four website scenarios—gaming rewards, freelance milestones, conditional commerce and agentic economy—are local demonstrations. The SDK does not make all four evidence sources live automatically.

Reclaim/GitHub proof work is deferred to [Future Integrations: Reclaim](../../future-integrations/reclaim/README.md). It is not required to import or use the base SDK.

## Package publishing (maintainer)

Use [.github/workflows/publish-npm.yml](../../.github/workflows/publish-npm.yml) from the repository's GitHub Actions page on the `main` branch. The workflow validates, builds and packs both packages, then publishes `@settleva/conditions` before `@settleva/sdk`. It has an explicit `publish_now` confirmation input, and version numbers come from each package's `package.json`.

For the initial publication, configure the GitHub Actions repository secret `NPM_TOKEN` with permission to publish these public packages. Run the workflow with `publish_now=true` only after confirming the package namespace is owned and release contents are correct.

After the first successful release, configure npm Trusted Publishing for each package: GitHub Actions, repository `Investorquab/Settleva`, workflow `publish-npm.yml`, environment `npm-publish`. Then remove `NPM_TOKEN` and use the workflow's GitHub OIDC identity for later publishes. See the root README for the full release steps.

Before announcing an SDK release, verify both package pages on npm and test a clean consumer install in a separate temporary project.

## Security boundaries

- The application keeps payer/payee wallet control and submits user-authorized transactions.
- The integrator selects and controls its verification authority for its own deployment.
- The backend validates source evidence and signs a payment-bound attestation.
- The contract enforces payment state, payee-only release, expiry/refund rules, attestation authorization and proof replay rejection.
- A playground result is not proof and does not transfer USDC.
