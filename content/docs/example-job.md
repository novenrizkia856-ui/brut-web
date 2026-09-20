# Example Job

A buyer creates the following request:

> Fine-tune a 7B model using 4x A100 GPUs for 6 hours.

The job can be represented as:

| Detail | Example |
|---|---|
| GPU requirement | A100 x4 |
| Workload | Model fine-tuning |
| Duration | 6 hours |
| Provider | Provider #4821 |
| Provider reputation | 98% |
| Price | $1.85 per GPU-hour |
| Total | $44.40 |
| Escrow | Funded before execution |
| Verification | Execution evidence + output hash |
| Provider stake | $50 at risk |
| Status | Running |

## Example Flow

1. Buyer creates the job.
2. Provider #4821 is selected.
3. Buyer locks $44.40 in escrow.
4. Provider starts execution.
5. Heartbeats show that the job is still running.
6. Provider submits the result and output hash.
7. BRUT checks the required verification input.
8. Job is marked completed.
9. Escrow releases payment.
10. Provider history is updated.

The user interface can also link to the relevant onchain job, escrow, verification, and settlement transactions.
