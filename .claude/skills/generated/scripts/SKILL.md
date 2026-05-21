---
name: scripts
description: "Skill for the Scripts area of nba-predict. 15 symbols across 1 files."
---

# Scripts

15 symbols | 1 files | Cohesion: 78%

## When to Use

- Working with code in `scripts/`
- Understanding how sendLoginForm, sendAuthChallenge, readRequestBody work
- Modifying scripts-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `scripts/temporary-auth-proxy.mjs` | sendLoginForm, sendAuthChallenge, readRequestBody, handleLogin, isApiPath (+10) |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `sendLoginForm` | Function | `scripts/temporary-auth-proxy.mjs` | 115 |
| `sendAuthChallenge` | Function | `scripts/temporary-auth-proxy.mjs` | 149 |
| `readRequestBody` | Function | `scripts/temporary-auth-proxy.mjs` | 169 |
| `handleLogin` | Function | `scripts/temporary-auth-proxy.mjs` | 185 |
| `isApiPath` | Function | `scripts/temporary-auth-proxy.mjs` | 220 |
| `proxyToApi` | Function | `scripts/temporary-auth-proxy.mjs` | 229 |
| `server` | Function | `scripts/temporary-auth-proxy.mjs` | 339 |
| `constantTimeMatches` | Function | `scripts/temporary-auth-proxy.mjs` | 57 |
| `parseCookies` | Function | `scripts/temporary-auth-proxy.mjs` | 63 |
| `hasAuthCookie` | Function | `scripts/temporary-auth-proxy.mjs` | 79 |
| `isAuthorized` | Function | `scripts/temporary-auth-proxy.mjs` | 86 |
| `withAuthCookie` | Function | `scripts/temporary-auth-proxy.mjs` | 158 |
| `upstream` | Function | `scripts/temporary-auth-proxy.mjs` | 234 |
| `resolveStaticPath` | Function | `scripts/temporary-auth-proxy.mjs` | 265 |
| `serveStatic` | Function | `scripts/temporary-auth-proxy.mjs` | 299 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Server → ParseCookies` | cross_community | 4 |
| `Server → ConstantTimeMatches` | cross_community | 4 |

## How to Explore

1. `gitnexus_context({name: "sendLoginForm"})` — see callers and callees
2. `gitnexus_query({query: "scripts"})` — find related execution flows
3. Read key files listed above for implementation details
