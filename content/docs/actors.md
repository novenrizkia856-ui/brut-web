# Actors

## Buyer

The buyer creates a compute job and funds payment.

Typical buyer actions:

- define GPU requirements,
- define workload type,
- define duration or budget,
- submit a container image or script reference,
- select or accept a provider,
- fund escrow,
- monitor status,
- receive the result,
- and participate in verification if needed.

## Provider

The provider owns or controls GPU capacity.

Typical provider actions:

- register GPU inventory,
- publish availability,
- publish price,
- optionally lock stake,
- accept a job,
- run the workload,
- submit execution evidence,
- provide the result,
- and receive payment after valid completion.

## Marketplace Protocol

The protocol coordinates the job relationship.

Its role is to keep a shared state for:

- job creation,
- matching,
- escrow,
- status,
- verification result,
- payout,
- stake,
- and reputation.

## Verification Source

A verification source is any system that contributes evidence about job execution.

Examples include:

- onchain contract state,
- hardware attestation,
- output hash comparison,
- job heartbeats,
- runtime monitoring,
- and execution logs.

Not every source has the same confidence level.
