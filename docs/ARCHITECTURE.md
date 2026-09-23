# Settleva Architecture

This document records the implementation architecture derived from the locked build brief.

## Core invariant

A payment can settle only when submitted evidence satisfies the exact condition committed when the payment was funded.

## System flow

Application -> Settleva SDK -> condition/payment engine -> evidence providers -> verification -> Arc settlement contract -> USDC.

## Initial implementation boundaries

- Conditions are structured data with deterministic canonicalization and hashing.
- Evidence providers implement a common provider abstraction.
- Verification results are structured and bound to a committed condition hash.
- The settlement contract owns locked USDC and enforces release/refund state transitions.
- Provider credentials and evidence retrieval stay server-side.
- The reference application consumes the SDK/backend rather than containing settlement authority.

## Trust model

A provider response is not treated as cryptographic proof merely because it came from an API. Provider-specific proof material and verifier behavior must be documented explicitly before it can authorize settlement.

## Current status

Architecture Lock is the next required design artifact before implementing the settlement contract or provider verifier.
