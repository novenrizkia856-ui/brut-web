# System Model

BRUT is a hybrid onchain/offchain system.

## Onchain Layer

The onchain layer is responsible for economic coordination and public state.

Typical responsibilities are:

- provider registration,
- provider stake,
- job identity,
- buyer and provider addresses,
- escrow balance,
- agreed price,
- job status,
- payout state,
- completion records,
- slashing records,
- reputation-related records,
- and links or hashes that reference verification evidence.

## Offchain Compute Layer

The offchain layer performs the actual GPU work.

It can produce:

- hardware information,
- execution logs,
- heartbeats,
- runtime measurements,
- output files,
- output hashes,
- and provider benchmarks.

## Trust Boundary

BRUT should never treat every offchain claim as equivalent to an onchain fact.

A useful separation is:

- **VERIFIED ONCHAIN** — directly readable from contracts.
- **VERIFIED VIA ATTESTATION** — supported by hardware attestation or cryptographic execution evidence.
- **REPORTED / UNVERIFIED** — submitted by a provider but not independently confirmed.

The system should make the source of a claim visible instead of presenting all data as equally trusted.
