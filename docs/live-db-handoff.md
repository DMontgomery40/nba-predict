# Live DB Handoff

This repo zip intentionally does not include David's large live SQLite database.

## Known live DB facts from David's running machine

The running API on port `8788` was not using either packaged DB in this worktree. It was using:

```text
/Users/davidmontgomery/nba-predict/data/signal-console.sqlite
```

David reported the active live DB contained:

| Table / concept    |   Count |
| ------------------ | ------: |
| quote ticks        | 761,407 |
| raw payloads       |  65,382 |
| games              |   1,237 |
| market instruments |   1,560 |
| outcomes           |     807 |

Source breakdown reported by David:

| Source     |   Ticks | Markets | Games |
| ---------- | ------: | ------: | ----: |
| polymarket | 690,803 |     854 |   208 |
| kalshi     |  70,272 |     898 |   435 |
| bet365     |     332 |     256 |     2 |

## Packaged DB trap

The zip contains two small DB files:

```text
data/signal-console.sqlite
data/signal-console.e2e.sqlite
```

Their roles:

- `data/signal-console.sqlite` has schema and no real rows.
- `data/signal-console.e2e.sqlite` is seeded test data.

Do not demo from either one unless the point of the demo is to show the empty/test-data guardrails.

## Required local env

Use this exact local DB path for David's machine:

```bash
cd /Users/davidmontgomery/nba-predict && printf '%s\n' 'SIGNAL_CONSOLE_DB_PATH=/Users/davidmontgomery/nba-predict/data/signal-console.sqlite' 'PORT=8788' 'VITE_API_BASE_URL=http://localhost:8788' >> .env.local && pnpm db:audit
```

`pnpm db:audit` should print `DB_AUDIT_PASS` when pointed at the large persisted DB.

## New runtime audit surface

This pass added:

```text
GET /api/v1/admin/runtime-audit
```

The Settings page now has a `Runtime evidence` panel that exposes:

- active SQLite path
- schema version
- WAL file presence
- quote tick count
- raw payload count
- game count
- market instrument count
- outcome count
- per-source source market, quote, payload, and game counts
- warnings when the active DB looks empty, seeded, or not ready

This exists to prevent the exact mistake where the UI is backed by a live local DB but the exported zip silently falls back to empty/default data.
