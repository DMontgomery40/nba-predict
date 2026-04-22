# Assumptions and Open Questions

## Assumptions

- `ASSUMP-001` The first delivery target is a strong internal demo and product review, not production trading deployment.
- `ASSUMP-002` Demo mode has higher immediate value than wiring fragile live adapters.
- `ASSUMP-003` The current repo has no established runtime stack, so a new monorepo scaffold is acceptable.
- `ASSUMP-004` SQLite is sufficient for local demo, replay, and test workloads.
- `ASSUMP-005` bet365 internal data will be represented through fixtures and adapter interfaces rather than a real internal connection in the first slice.
- `ASSUMP-006` The product can use deterministic narrative templating without requiring live LLM credentials.

## Open Questions

- `OPEN-001` Which exact market types should ship beyond winner markets in the first review build?
- `OPEN-002` How much internal exposure detail is safe to simulate in demo fixtures?
- `OPEN-003` What should the live-adapter authentication and secret-management story be when real endpoints are wired?
- `OPEN-004` Should replay selection be session-local only, or persisted per operator?

## Recommended Next Decisions

- `REC-001` Ship first with polished winner-market coverage plus representative exposure, health, and replay flows.
- `REC-002` Treat live adapters as pluggable and keep the demo/replay path first-class.
- `REC-003` Keep audit events and watchlist persistence in SQLite from day one so future review builds feel grounded.
