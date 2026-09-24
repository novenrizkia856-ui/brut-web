# BRUT

BRUT is a permissionless onchain marketplace for renting GPU compute, built on Solana.

GPU providers make idle GPU capacity available to buyers. Buyers create compute jobs, lock payment in escrow, match with a provider, receive execution results, and settle the job through onchain rules.

The core idea is simple:

> Idle GPUs. Real jobs. Paid onchain.

BRUT does not try to become a cloud provider itself. It coordinates supply, demand, escrow, verification, reputation, and settlement between independent compute buyers and GPU providers.

## Core Product Loop

1. A provider registers available GPU capacity.
2. A buyer creates a compute job.
3. The buyer funds escrow before execution starts.
4. A provider is selected or matched.
5. The provider runs the job offchain.
6. Job progress and verification inputs are recorded.
7. Completion is verified.
8. Payment is released according to the job rules.
9. Reputation is updated from the result.

## Documentation Scope

These docs describe the technical concepts, system mechanics, state model, trust model, and MVP scope of BRUT.

They intentionally avoid implementation-specific Solana program architecture so the product can be built quickly and the program design can remain flexible during development.
