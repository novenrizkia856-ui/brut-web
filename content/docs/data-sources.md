# Data Sources

BRUT uses multiple data sources because not every part of a GPU job exists onchain.

## Onchain Sources

These are read directly from BRUT program accounts on Solana.

Examples:

- escrow balance,
- release conditions,
- provider stake,
- slashing history,
- job status,
- and payout progress.

These facts have the strongest direct relationship with the protocol because they are part of blockchain state.

## Offchain Sources

These are collected from the compute environment.

Examples:

- GPU model and count,
- execution logs,
- output hashes,
- heartbeat data,
- uptime monitoring,
- and provider benchmarks.

Offchain data should include a source and confidence level.

## Source Visibility

The frontend should avoid presenting all information as if it came from the same trust source.

For each relevant claim, BRUT can show whether it is:

- verified onchain,
- verified via attestation,
- or reported and unverified.

This makes the trust model understandable without pretending that offchain GPU execution is automatically trustless.
