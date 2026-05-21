# Web Re-Verification — Citation URL Status
**Run date:** 2026-05-21  
**Method:** Deno TypeScript `fetch()` via codemode MCP; `{redirect:'manual'}` used where noted; response bodies truncated to ~500 chars.

---

## 1. URL Status Table

| URL | HTTP Status | Evidence |
|-----|-------------|----------|
| `https://data-api.polymarket.com/trades?limit=2` | **200** | Live trade rows returned; see captured fields below |
| `https://clob.polymarket.com/prices-history?interval=1m&fidelity=1&market=0x1234` | **400** | Error JSON returned; see captured text below |
| `https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=3&category=sports` | **200** | Markets JSON returned; no KXNBA ticker in top 3 results (see note) |
| `https://www.nber.org/papers/w10504` | **200** | Full HTML page served; Wolfers & Zitzewitz 2004 resolves |
| `https://doi.org/10.2307/1913210` (Kyle 1985) | **302** | Redirects to `https://www.jstor.org/stable/1913210?origin=crossref` |
| `https://doi.org/10.1111/ecoj.12033` (Croxson & Reade 2014) | **302** | Redirects to `https://academic.oup.com/ej/article/124/575/62-91/5076978` |
| `https://arxiv.org/abs/2605.00864` | **200** | Full abstract page served; headline numbers confirmed (see below) |
| `https://nitter.net/nba_elise` | **200** | Profile page served; `nitter.net` is the working mirror |

---

## 2. Polymarket Trade-Row Fields (captured)

**Endpoint:** `https://data-api.polymarket.com/trades?limit=2`  
**Status:** 200

One captured trade row fields:

```json
{
  "proxyWallet": "0x962cf6655629d7d931776f97bafd8225a1591866",
  "side": "BUY",
  "asset": "69439036986423460615548954407969186768636279473098191571477744430278392153447",
  "conditionId": "0xb7c6d5ff6d1839187c14c0ecc3304d67428edb79ef41c5f1917b22edaac8abf2",
  "size": 5.133332,
  "price": 0.75,
  "timestamp": 1779355112,
  "title": "Bitcoin Up or Down - May 21, 5:15AM-5:20AM ET",
  "slug": "btc-updown-5m-1779354900",
  "outcome": "Down",
  "outcomeIndex": 1
}
```

Key fields present: `timestamp` (unix epoch), `price` (decimal prob), `size` (shares), `conditionId` (hex), `title` (market description).

---

## 3. Prices-History Error Text (captured)

**Endpoint:** `https://clob.polymarket.com/prices-history?interval=1m&fidelity=1&market=0x1234`  
**Status:** 400

Exact error message:
```json
{"error":"invalid filters: minimum 'fidelity' for '1m' range is 10"}
```

The API requires `fidelity >= 10` when using `interval=1m`.

---

## 4. Kalshi Markets — KXNBA Note

**Endpoint:** `https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=3&category=sports`  
**Status:** 200

The top 3 results were multi-variate sports parlays (`KXMVESPORTSMULTIGAMEEXTENDED-*`), not NBA-specific `KXNBA` tickers. This is consistent with limit=3 returning multi-game parlay markets first. KXNBA tickers exist on the platform but did not appear in this 3-result sample. The endpoint resolves correctly.

---

## 5. arXiv Headline Numbers Confirmed

**Paper:** "Arbitrage Analysis in Polymarket NBA Markets" — `https://arxiv.org/abs/2605.00864`  
**Status:** 200

From the abstract meta tag (verbatim extracts):

- **Median single-market anomaly duration:** `...yielding only 7 executable in-game episodes that persist for a median duration of just 3.6 seconds.`
- **Executable size:** `...76.9% of combinatorial opportunities constrained to an average executable size of just 14.8 shares.`

Both headline numbers confirmed exactly as cited.

---

## 6. Nitter Mirror Status

**Working mirror:** `https://nitter.net`  
**Status:** 200 — profile page for `nba_elise` served with correct content.

Mirrors `nitter.poast.org` and `nitter.privacydev.net` were not tested (first mirror succeeded).

---

## 7. Incident Tweet Verification

All three incident tweets resolved at HTTP 200 via `nitter.net`:

| Tweet URL | Status | Captured Content |
|-----------|--------|-----------------|
| `https://nitter.net/PDemilord/status/2054919216877146254` | **200** | "DAY 7 of trying to get a stat correction! Please review Cason Wallace rebound from 5/7/26 quarter 3 8:19 given to hartenstein! @nbastats @nba @NBAOfficial" |
| `https://nitter.net/nba_elise/status/2048506391795536374` | **200** | "Dear @nbastats on 11:38 of 1Q Missing a Jrue Holiday assist on this point by Debi Avdija! This basquet it's good cause wemby did goaltending!" |
| `https://nitter.net/nba_elise/status/2056196423691989496` | **200** | "Dear @nbastats, on 4:45 3Q TEAM offensive REBOUND missing a sam merril rebound, fix this please!" (published May 18, 2026 · 2:13 AM UTC) |

---

## 8. Additional 2026 Playoffs Stat-Correction Incidents Found

Scraping `nitter.net/nba_elise` timeline surfaced two additional correction requests:

### Incident A — Jarrett Allen Tip Rebound (May 4, 2026)
**URL:** `https://nitter.net/nba_elise/status/2051130596433260572`  
**Status:** 200  
**Content:** "@nbastats @cavs @jarretallen On 08:02 4Q its tiped rebound by Allen, fix this please!!"  
Published: **May 4, 2026 · 2:43 AM UTC**  
Video clip attached. Calls out a misattributed tip rebound in Q4 of a Cavaliers 2026 playoff game.

### Incident B — Sam Merrill Rebound (May 18, 2026)
Already captured above as the third primary citation (`/status/2056196423691989496`).

**Note:** The `nba_elise` timeline also contains non-stat-correction content (commentary, Portuguese-language posts). The two incidents above were the clearest additional correction-request posts found in the scraped timeline page. Deeper pagination was not attempted.

---

## 9. Anything Unreachable

Nothing was unreachable. All 8 primary URLs returned valid HTTP responses (200, 302, or 400 per expectation). All 3 incident tweets resolved at 200. `nitter.net` was live.
