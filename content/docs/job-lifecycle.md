# Job Lifecycle

A BRUT job moves through a simple sequence from demand creation to settlement.

## 1. Job Creation

The buyer defines the requested compute.

A job can include:

- required GPU type,
- GPU count,
- workload type,
- expected duration,
- maximum budget,
- container image or script reference,
- geographic or latency constraints,
- and verification expectations.

## 2. Provider Matching

The job is matched with an available provider.

Matching can consider:

- GPU inventory,
- price per GPU-hour,
- provider reputation,
- uptime history,
- region,
- and latency requirements.

For the first version, matching can remain simple. A fixed-price listing or basic order-book model is enough.

## 3. Escrow Funding

Before the job starts, the buyer locks funds in escrow.

This prevents a provider from performing work without funded payment.

## 4. Job Start

After the provider is selected and escrow is funded, the job can enter the running state.

The provider executes the workload offchain.

## 5. Progress

During execution, BRUT can receive progress evidence such as:

- heartbeats,
- uptime records,
- execution logs,
- and milestone signals.

## 6. Result Submission

The provider submits the result and associated verification evidence.

At minimum, this can include an output hash.

## 7. Verification

The system checks the available evidence and determines whether the completion conditions were met.

## 8. Settlement

If completion is accepted, payment is released according to the payout rule.

If the job fails, payment follows the failure rule and provider stake may be affected when applicable.

## 9. Reputation Update

The result contributes to the provider's history.

Completed jobs improve the provider's record. Failed or fraudulent behavior can reduce trust and may trigger slashing.
