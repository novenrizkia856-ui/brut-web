# Job States

BRUT uses explicit job states so both buyer and provider can understand the current stage of a job.

## Core States

| State | Meaning |
|---|---|
| Queued | Job exists but execution has not started |
| Running | Provider is executing the workload |
| Completed | Job passed the completion rule |
| Failed | Job did not complete successfully |
| Disputed | Completion or settlement is challenged |

## Simple State Flow

```text
Queued
  |
  v
Running
  |   |    v   v
Completed  Failed
          Disputed
```

The exact transition rules belong to the program implementation, but every transition should be explicit and auditable.

## Two-Day Build

For the first build, the active states can be kept minimal:

```text
Queued -> Running -> Completed
                  -> Failed
```

`Disputed` can remain part of the documented full concept without requiring an arbitration system in the first version.
