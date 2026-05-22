---
name: codex-hooks
description: "Skill for the Codex-hooks area of nba-predict. 26 symbols across 1 files."
---

# Codex-hooks

26 symbols | 1 files | Cohesion: 71%

## When to Use

- Working with code in `packages/`
- Understanding how applyStopEvent, buildBugfixPolicyContext, detectBugfixIntent work
- Modifying codex-hooks-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | buildEmptyState, readState, summarizeMissingCoverage, shouldGateStop, buildStopReason (+21) |

## Entry Points

Start here when exploring this area:

- **`applyStopEvent`** (Function) — `packages/shared/src/codex-hooks/bugfix-regression-guard.ts:470`
- **`buildBugfixPolicyContext`** (Function) — `packages/shared/src/codex-hooks/bugfix-regression-guard.ts:146`
- **`detectBugfixIntent`** (Function) — `packages/shared/src/codex-hooks/bugfix-regression-guard.ts:156`
- **`applyUserPromptEvent`** (Function) — `packages/shared/src/codex-hooks/bugfix-regression-guard.ts:411`
- **`classifyBashCommand`** (Function) — `packages/shared/src/codex-hooks/bugfix-regression-guard.ts:191`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `applyStopEvent` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 470 |
| `buildBugfixPolicyContext` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 146 |
| `detectBugfixIntent` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 156 |
| `applyUserPromptEvent` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 411 |
| `classifyBashCommand` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 191 |
| `applyPostToolUseEvent` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 429 |
| `extractPatchedFiles` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 169 |
| `isTestPath` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 186 |
| `buildEmptyState` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 129 |
| `readState` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 252 |
| `summarizeMissingCoverage` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 381 |
| `shouldGateStop` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 397 |
| `buildStopReason` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 403 |
| `slugPath` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 205 |
| `resolveRepoRoot` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 209 |
| `resolveStateRoot` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 227 |
| `resolveStatePath` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 239 |
| `writeState` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 278 |
| `deleteState` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 288 |
| `readStdinJson` | Function | `packages/shared/src/codex-hooks/bugfix-regression-guard.ts` | 520 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ApplyPostToolUseEvent → ResolveRepoRoot` | cross_community | 4 |
| `ApplyPostToolUseEvent → ResolveStateRoot` | cross_community | 4 |
| `ApplyPostToolUseEvent → SlugPath` | cross_community | 4 |
| `ApplyStopEvent → ResolveRepoRoot` | cross_community | 4 |
| `ApplyStopEvent → ResolveStateRoot` | cross_community | 4 |
| `ApplyStopEvent → SlugPath` | cross_community | 4 |
| `ApplyUserPromptEvent → ResolveRepoRoot` | cross_community | 4 |
| `ApplyUserPromptEvent → ResolveStateRoot` | cross_community | 4 |
| `ApplyUserPromptEvent → SlugPath` | cross_community | 4 |

## How to Explore

1. `gitnexus_context({name: "applyStopEvent"})` — see callers and callees
2. `gitnexus_query({query: "codex-hooks"})` — find related execution flows
3. Read key files listed above for implementation details
