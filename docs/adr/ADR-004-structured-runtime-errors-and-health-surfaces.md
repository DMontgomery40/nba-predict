# ADR-004: Structured Runtime Errors And Health Surfaces

## Decision

Use typed error envelopes and explicit health/readiness routes for live research operations.

## Scope

- request IDs on every API response
- stable error codes for validation, lookup, database, and adapter failures
- readiness based on database, sidecar/session/auth inputs, and persisted live-data presence
