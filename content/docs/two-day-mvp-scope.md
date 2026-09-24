# Two-Day MVP Scope

BRUT should begin very narrow.

The goal of the first build is not to solve every decentralized-compute problem. It is to demonstrate the full economic loop with the smallest coherent system.

## Build Now

### 1. One Chain

Deploy on Solana only.

No multi-chain coordination is required.

### 2. Provider Registration

A provider can register:

- identity/address,
- GPU inventory,
- basic price,
- and optional stake.

### 3. Job Posting

A buyer can create a compute job with:

- GPU requirement,
- workload type,
- duration or budget,
- and workload reference.

### 4. Simple Matching

Use either:

- fixed-price provider listings,
- or a very small order-book-style selection flow.

No complex matching engine is required.

### 5. Escrow

Buyer funds must be locked before execution begins.

The first version can use final payout on verified completion.

### 6. Basic Verification

Use a narrow mechanism based on:

- heartbeat or uptime signal,
- and output hash.

This is intentionally simpler than full hardware attestation.

### 7. Job Status

Support the minimum useful state flow:

```text
Queued -> Running -> Completed
                  -> Failed
```

### 8. Basic Reputation

Record provider completion history.

A simple completed/failed history is enough for the first version.

### 9. Frontend

The frontend only needs to support the core journey:

- browse providers,
- post a job,
- fund the job,
- view status,
- and view completion or failure.

## Do Not Build Yet

Do not spend the two-day window on:

- dispute arbitration,
- multi-chain support,
- exotic GPU types,
- complex dynamic pricing,
- advanced reputation formulas,
- a native token,
- fully trustless hardware proof,
- or a generalized cloud orchestration platform.

The first version should prove one thing: BRUT can coordinate a GPU job between two parties with funded escrow, explicit status, verification evidence, and settlement.
