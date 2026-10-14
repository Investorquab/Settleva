# Security policy

Settleva handles payment commitments and backend attestations. Please treat suspected vulnerabilities as sensitive.

## Reporting a vulnerability

- **Do not open a public GitHub issue with exploit details, private keys, transaction-signing material, or a report that would immediately expose a live deployment.**
- Use GitHub's private vulnerability-reporting option for this repository if it is enabled. If it is unavailable, contact the repository maintainer privately through the [maintainer's GitHub profile](https://github.com/Investorquab) and request a private reporting channel before sending sensitive details.
- Include the affected component/revision, impact, reproducible steps, and any suggested mitigation. Redact secrets and personal information.

## Scope and disclosure

The repository's [Security model](docs/SECURITY_MODEL.md) describes the key boundaries, backend-attested trust model, replay defenses, and known limits. It is an engineering design note, **not a third-party smart-contract audit or a guarantee that every integration is safe**.

Do not use production funds for experiments. The deployed demonstration has a specific verifier key and a controlled test history; integrators must assess their own source, signer, wallet, and deployment risks independently.
