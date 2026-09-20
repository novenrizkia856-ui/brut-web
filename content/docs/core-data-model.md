# Core Data Model

The following conceptual model captures the information BRUT needs to represent.

## Job Identity

- Job ID
- Buyer address
- Provider address

## Requirements

- GPU type
- GPU count
- Workload type
- Duration
- Budget
- Container image or script reference

## Matching

- Price per GPU-hour
- Provider reputation
- Region
- Latency constraints

## Escrow

- Locked amount
- Payout schedule
- Release conditions

## Verification

- Hardware attestation reference
- Output hash
- Uptime or heartbeat record
- Verification label

## Reputation

- Provider stake
- Completed job history
- Failed job history
- Slashing events
- Buyer payment history

## Status

- Queued
- Running
- Completed
- Failed
- Disputed

## Sources

- Onchain source
- Attestation source
- Reported source
- Last updated timestamp or block context

The data model is conceptual. It does not require every field to live directly inside one smart contract.
