# @settleva/conditions

Deterministic policy types, canonicalization, commitment hashing and claim evaluation for Settleva integrations.

This package is a dependency of @settleva/sdk and is prepared for public npm publication. The package owner must publish it before publishing the SDK. It supports version 1.0 conditions and the exact string equality operator (equals) today.

The package evaluates claims supplied by a verification path; it does not independently prove those claims. A production integration must validate evidence from a source authoritative for the outcome before relying on an evaluation result.

After publication, install it directly only if your application needs to work with condition types or evaluation helpers outside the SDK. Most integrations can install @settleva/sdk, which includes this package as a dependency.

Maintainer release: from a clean repository checkout, run pnpm install --frozen-lockfile, pnpm check, pnpm test and pnpm build. Publish this package before @settleva/sdk using pnpm --filter @settleva/conditions publish --access public. Registry publication requires npm authorization.
