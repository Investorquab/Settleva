# Roadmap and open gaps

This is a short list of work not yet demonstrated by the current code/deployment. It is not a promise that every item is in scope for the next release.

## Required before production claims

- **Ship a reproducible provider adapter.** Move the ad hoc GitHub/Vercel status test into version-controlled integration code with clear ownership, configuration, tests, and logs that avoid secrets. Be explicit that a server-side adapter signature is not a GitHub cryptographic signature.
- **Separate the source trust boundary.** For production, have the authoritative source system sign its own outcome or run the adapter in an explicitly trusted source service with protected key custody. Do not imply the current VPS-side test adapter is independently operated.
- **Exercise distinct payer and payee identities.** Complete one small but normal two-party flow and independently check both the release event and recipient balance.
- **Complete negative-case acceptance.** Record tests for altered request bytes, invalid signatures, stale timestamps, invalid claims, mismatched condition/provider, duplicate/conflicting replay, and unavailable replay storage.
- **Test expiry and refund.** Use a separate payment and verify the payer-only refund after expiry.
- **Review operations.** Add/request ingress rate limiting, monitoring/alerting, secret rotation procedures, and a tested backup/recovery path before broader production use.

## Documentation and release hygiene

- Keep [STATUS.md](STATUS.md) updated when the deployed address, API, provider test, or acceptance evidence changes.
- Keep simulated scenarios clearly marked as local examples.
- Publish only verifiable test transaction links and state what each proves.
- Agree a repository-wide license before adding a root `LICENSE` file. The npm packages declare MIT and Solidity sources use MIT SPDX headers, but the repository currently has no root license file.

## Out of current scope

The Reclaim/GitHub proof exploration is deferred and preserved under [future-integrations/reclaim](../future-integrations/reclaim/README.md). The base SDK and contract do not require Reclaim. Do not resume this experiment or broaden the scenario UI without an explicit product decision.
