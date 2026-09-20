# Escrow and Payments

Escrow is the main payment guarantee in BRUT.

## Funding

The buyer locks the agreed amount before the provider begins work.

The locked amount represents the maximum payment available for that job under the agreed terms.

## Why Escrow Matters

Escrow protects both sides:

- the provider can verify that payment exists before starting,
- the buyer knows the funds cannot be paid outside the agreed rules,
- and the settlement state is transparent onchain.

## Payout Models

The broader BRUT concept supports two payout styles.

### Final Release

The full payment remains locked until the job is verified as completed.

This is the simplest model.

### Streaming or Milestone Payout

Part of the payment can be released as the job progresses, with a final amount released after completion verification.

This is useful for longer jobs, but it increases protocol complexity.

## Failure

If the job does not satisfy the release conditions, full payment should not automatically be released.

Failure handling can depend on:

- timeout,
- provider disappearance,
- invalid result,
- missing verification evidence,
- or another agreed failure condition.

## MVP Direction

For a two-day build, a simple funded escrow plus final release is the cleanest core mechanism.

Streaming and more advanced milestone logic can remain documented as an extension of the product concept.
