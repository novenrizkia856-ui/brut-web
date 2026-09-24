# API Model

The API is an interface between the frontend, compute coordination layer, and BRUT protocol state.

The following routes describe the conceptual product interface.

## Providers

### `GET /providers`

Returns available providers and their public marketplace information.

### `GET /providers/{id}`

Returns details for one provider.

Possible information:

- GPU inventory,
- price,
- reputation,
- availability,
- region,
- and history.

## Jobs

### `POST /jobs`

Creates a new job request.

### `GET /jobs/{id}`

Returns the job's main data.

### `GET /jobs/{id}/status`

Returns the current job state.

### `POST /jobs/{id}/verify`

Submits or triggers verification data for the job.

### `GET /jobs/{id}/escrow`

Returns escrow-related information.

### `GET /jobs/{id}/sources`

Returns the sources and confidence labels associated with job claims.

## Role of the API

The API is not the final trust source for onchain facts.

When data comes from the Solana program, the source of truth remains the onchain account state. The API mainly makes product data easier for the frontend to consume.
