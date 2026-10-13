# @settleva/conditions

Deterministic policy types, canonicalization, commitment hashing and claim evaluation for Settleva integrations.

This package is a public npm dependency of `@settleva/sdk`. Version `0.1.0` is released; the next patch release, `0.1.1`, is being prepared alongside the SDK documentation correction. It supports version 1.0 conditions and the exact string equality operator (equals) today.

The package evaluates claims supplied by a verification path; it does not independently prove those claims. A production integration must validate evidence from a source authoritative for the outcome before relying on an evaluation result.

Install it directly only if your application needs condition types or evaluation helpers outside the SDK. Most integrations can install `@settleva/sdk`, which includes this package as a dependency.

Maintainer release: from a clean repository checkout, run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test` and `pnpm build`. Stage both packages with the repository's GitHub Actions workflow and npm Trusted Publishing. Approve `@settleva/conditions` and verify it is live before approving the dependent `@settleva/sdk`. Do not use direct `npm publish` for this workflow.
