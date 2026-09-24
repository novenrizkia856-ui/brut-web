# Trust and Failure Model

BRUT reduces trust in the economic exchange, but the first version does not eliminate every trust assumption around offchain compute.

## What Is Trust-Minimized

The following can be enforced or observed onchain:

- whether payment was funded,
- who the buyer is,
- who the provider is,
- the current recorded job state,
- whether payment was released,
- provider stake,
- and recorded slashing events.

## What Requires Offchain Evidence

The following cannot be proven by ordinary contract state alone:

- exact GPU hardware used,
- whether every computation step was correct,
- actual runtime performance,
- execution logs,
- and physical provider uptime.

These claims need attestation, cryptographic proof, monitoring, or a weaker reported status.

## Failure Cases

### Provider Does Not Start

The job stays uncompleted and should not release full payment.

### Provider Disappears Mid-Job

The job can eventually fail through a timeout rule.

### Invalid or Missing Result

Completion should not be accepted if required evidence is missing.

### Hardware Claim Cannot Be Verified

The claim should be shown as reported or unverified instead of being presented as proven.

### Buyer Refuses to Pay

This risk is reduced by requiring escrow funding before the job begins.

## Disputes

The complete product concept includes a dispute path.

However, a full arbitration system is intentionally excluded from the two-day MVP.
