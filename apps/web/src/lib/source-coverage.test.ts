import { describe, expect, it } from "vitest";

import {
  formatMarketSourceList,
  formatMarketSourceSummary,
  getMarketSources,
  hasNbaStateSource,
} from "./source-coverage";

describe("source coverage helpers", () => {
  it("separates NBA state from market feeds", () => {
    expect(getMarketSources(["polymarket", "nba"])).toEqual(["polymarket"]);
    expect(hasNbaStateSource(["polymarket", "nba"])).toBe(true);
  });

  it("summarizes mixed market and nba coverage without overstating books", () => {
    expect(formatMarketSourceSummary(["polymarket", "nba"])).toBe(
      "1 market source"
    );
    expect(
      formatMarketSourceSummary(["bet365", "kalshi", "polymarket", "nba"])
    ).toBe("3 market sources");
  });

  it("handles nba-only and empty market coverage honestly", () => {
    expect(formatMarketSourceSummary(["nba"])).toBe("Scoreboard only");
    expect(formatMarketSourceSummary([])).toBe("No market sources");
    expect(formatMarketSourceList(["nba"])).toBe("none");
  });
});
