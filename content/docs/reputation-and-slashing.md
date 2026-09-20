# Reputation and Slashing

Reputation gives future buyers information about provider reliability.

Slashing gives providers an economic reason not to fail or submit fraudulent claims.

## Provider Reputation

A provider reputation record can be based on:

- completed jobs,
- failed jobs,
- uptime history,
- verification success,
- and slashing history.

The first version can keep reputation simple instead of creating a complicated score.

## Provider Stake

A provider may lock stake before taking jobs.

The stake can be at risk when a defined failure or fraud condition occurs.

## Slashing

Slashing is the loss of some or all provider stake.

Possible reasons include:

- provable failure,
- fraudulent completion claim,
- or violation of a job rule.

The exact slash formula is an implementation decision and does not need to be complex in the first version.

## Buyer History

The broader design can also track buyer payment reliability.

However, if all buyer payments are fully escrowed before execution, the main payment risk is already reduced by the protocol.

## MVP Direction

For a fast first build:

- record provider completed jobs,
- record failed jobs,
- optionally require provider stake,
- and keep slashing rules narrow and explicit.

Complex dispute arbitration is outside the initial scope.
