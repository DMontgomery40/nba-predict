# ADR-002: Live-Only Research Runtime

## Decision

Remove presentation-only runtime paths and treat persisted live data as the only valid source for research routes.

## Consequences

- no synthetic mode selection
- no curated scenario selection
- no silent fallback when capture data is missing
- readiness stays red until live dependencies and persisted live data are present
