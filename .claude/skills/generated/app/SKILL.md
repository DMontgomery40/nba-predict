---
name: app
description: "Skill for the App area of nba-predict. 12 symbols across 5 files."
---

# App

12 symbols | 5 files | Cohesion: 74%

## When to Use

- Working with code in `apps/`
- Understanding how useAppStore, App, ShellLayout work
- Modifying app-related functionality

## Key Files

| File                                               | Symbols                                                                          |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/web/src/app/ShellLayout.tsx`                 | workspaceStatus, workspaceTitle, ShellLayout, isEditableTarget, openCommand (+2) |
| `apps/web/src/app/AppRoutes.test.tsx`              | mockJsonResponse, createSettingsFetchImplementation                              |
| `apps/web/src/app/store.ts`                        | useAppStore                                                                      |
| `apps/web/src/app/App.tsx`                         | App                                                                              |
| `apps/web/src/features/command/CommandPalette.tsx` | CommandPalette                                                                   |

## Entry Points

Start here when exploring this area:

- **`useAppStore`** (Function) — `apps/web/src/app/store.ts:10`
- **`App`** (Function) — `apps/web/src/app/App.tsx:21`
- **`ShellLayout`** (Function) — `apps/web/src/app/ShellLayout.tsx:98`
- **`CommandPalette`** (Function) — `apps/web/src/features/command/CommandPalette.tsx:11`
- **`openCommand`** (Function) — `apps/web/src/app/ShellLayout.tsx:102`

## Key Symbols

| Symbol                              | Type     | File                                               | Line |
| ----------------------------------- | -------- | -------------------------------------------------- | ---- |
| `useAppStore`                       | Function | `apps/web/src/app/store.ts`                        | 10   |
| `App`                               | Function | `apps/web/src/app/App.tsx`                         | 21   |
| `ShellLayout`                       | Function | `apps/web/src/app/ShellLayout.tsx`                 | 98   |
| `CommandPalette`                    | Function | `apps/web/src/features/command/CommandPalette.tsx` | 11   |
| `openCommand`                       | Function | `apps/web/src/app/ShellLayout.tsx`                 | 102  |
| `onKeyDown`                         | Function | `apps/web/src/app/ShellLayout.tsx`                 | 110  |
| `handler`                           | Function | `apps/web/src/app/ShellLayout.tsx`                 | 130  |
| `workspaceStatus`                   | Function | `apps/web/src/app/ShellLayout.tsx`                 | 26   |
| `workspaceTitle`                    | Function | `apps/web/src/app/ShellLayout.tsx`                 | 63   |
| `isEditableTarget`                  | Function | `apps/web/src/app/ShellLayout.tsx`                 | 85   |
| `mockJsonResponse`                  | Function | `apps/web/src/app/AppRoutes.test.tsx`              | 36   |
| `createSettingsFetchImplementation` | Function | `apps/web/src/app/AppRoutes.test.tsx`              | 68   |

## Execution Flows

| Flow                           | Type            | Steps |
| ------------------------------ | --------------- | ----- |
| `App → SectionTitle`           | cross_community | 4     |
| `App → Cx`                     | cross_community | 4     |
| `App → UseAppStore`            | intra_community | 3     |
| `App → WorkspaceTitle`         | intra_community | 3     |
| `App → WorkspaceStatus`        | intra_community | 3     |
| `App → PageFrame`              | cross_community | 3     |
| `App → IsDeskBootstrapPending` | cross_community | 3     |
| `App → LoadingState`           | cross_community | 3     |
| `App → IsDateInputValue`       | cross_community | 3     |
| `App → UtcIsoDate`             | cross_community | 3     |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Alerts     | 3 calls     |
| Components | 3 calls     |
| Desk       | 1 calls     |
| Divergence | 1 calls     |
| Research   | 1 calls     |
| History    | 1 calls     |
| Games      | 1 calls     |
| Event      | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "useAppStore"})` — see callers and callees
2. `gitnexus_query({query: "app"})` — find related execution flows
3. Read key files listed above for implementation details
