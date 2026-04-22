# nba-predict Agent Notes

This repo is live-only. Do not add synthetic modes, curated scenarios, seeded historical packs, or presentation-only data paths back into the runtime.

## Source Of Truth

- Live research data must come from persisted `games`, `game_states`, `market_instruments`, `source_markets`, `quote_ticks`, `raw_payloads`, `adapter_runs`, `mapping_resolutions`, and `game_outcomes`.
- NBA game-state truth comes through `apps/nba-sidecar`.
- If a workflow is not backed by persisted live data yet, describe it as pending rather than inventing a fallback.

## Architecture Boundaries

- `apps/api`
  - serves live research and admin routes only
- `apps/worker`
  - orchestrates ingestion and adapter run logging
- `apps/nba-sidecar`
  - Python `nba_api` sidecar
- `packages/shared`
  - repositories, migrations, errors, logging
- `packages/domain`
  - shared schemas and canonical live/research contracts

## Drift Prevention

- Update `README.md` whenever commands, required env, or runtime surfaces change.
- Update relevant `specs/*.md` files when storage, API, or UX contracts change.
- Update `PLAN.md` inline during long-running work so it reflects completed slices and the next concrete step.
- Do not describe the system as a presentation shell or synthetic-data console.
- If generated `dist` output is rebuilt locally, verify it stays aligned with the live-only source tree and does not reintroduce retired runtime language.

## Validation

- TypeScript workspace: `pnpm verify`
- Python sidecar when touched: `cd apps/nba-sidecar && uv run pytest`

## Guardrails

- Health and readiness should fail honestly when required live dependencies or persisted live data are missing.
- Spread/total/prop line mismatch must remain distinct from like-for-like probability divergence.
- Manual mapping flows should keep unmapped markets visible until they are explicitly resolved.
