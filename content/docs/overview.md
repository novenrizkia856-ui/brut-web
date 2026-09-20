# Overview

BRUT is an onchain GPU compute marketplace that connects people who need compute with people who own idle GPUs.

The marketplace itself does not own the hardware. The actual compute runs offchain on provider-controlled machines. BRUT coordinates the economic agreement around that compute onchain.

The system combines five core functions:

| Function | Purpose |
|---|---|
| Marketplace | Expose GPU supply and compute demand |
| Matching | Connect a job with a suitable provider |
| Escrow | Lock buyer funds before execution |
| Verification | Determine whether the agreed job completed |
| Reputation | Record provider reliability over time |

The blockchain is used for the parts that benefit from deterministic rules and transparent settlement. GPU execution remains offchain because training, inference, and rendering cannot practically run inside a normal smart contract.

## Primary Goal

Create a simple market where a buyer can request GPU compute from an unknown provider without relying only on informal trust.

The buyer should know what was requested, what price was agreed, what funds are locked, what the current job state is, and what evidence was used before payment is released.

The provider should know that payment was funded before work begins and that the settlement conditions are known in advance.
