# Verification

Verification is the mechanism used to decide whether a job should be treated as successfully completed.

Because GPU execution happens offchain, BRUT must distinguish between direct blockchain facts and offchain evidence.

## Verification Inputs

Possible inputs include:

- hardware attestation,
- output hash,
- execution logs,
- heartbeat data,
- uptime history,
- runtime monitoring,
- and other proof-of-execution signals.

## Output Integrity

A basic completion check can compare an expected or submitted result reference with an output hash.

The hash does not prove every detail of execution by itself. It provides integrity for the referenced output.

## Hardware Claims

A provider can claim that a job used a specific GPU model and count.

A stronger version of BRUT can support hardware attestation or cryptographic proof that improves confidence in this claim.

Without such evidence, hardware claims should be clearly marked as reported rather than fully verified.

## Verification Labels

### VERIFIED ONCHAIN

The claim is directly readable from marketplace or escrow contract state.

Examples:

- escrow balance,
- payout state,
- provider stake,
- job status,
- slashing record.

### VERIFIED VIA ATTESTATION

The claim is supported by a hardware attestation or cryptographic proof-of-execution mechanism.

### REPORTED / UNVERIFIED

The claim was submitted by a provider and has not been independently verified.

## Release Rule

BRUT should not release full payment based only on an unverified claim when the job requires stronger evidence.

For the initial build, the verification rule can be intentionally narrow: heartbeat plus output-hash-based completion.
