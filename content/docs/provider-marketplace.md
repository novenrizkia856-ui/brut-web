# Provider Marketplace

Providers represent the supply side of BRUT.

## Provider Inventory

A provider listing can expose:

- provider address or identifier,
- GPU model,
- GPU count,
- current availability,
- price per GPU-hour,
- region,
- latency-related information,
- reputation,
- uptime history,
- and provider-submitted benchmarks.

## Price Discovery

BRUT is intended to make fragmented GPU supply easier to compare.

Two simple pricing models fit the concept:

### Fixed Price

The provider publishes a price per GPU-hour.

The buyer chooses a provider based on requirements and price.

### Basic Bid or Order Book

Providers can offer prices against posted demand.

This can improve price discovery, but it is not required for the first build.

## Matching

A provider is suitable only if it satisfies the job's minimum requirements.

Matching can use:

- required GPU model,
- GPU count,
- expected duration,
- provider availability,
- price,
- reputation,
- and optional region constraints.

The first version should prioritize understandable matching over complex optimization.
