import { expect, test } from "@playwright/test";

test("trader desk opens the top ranked instrument", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "What the markets actually knew.",
    })
  ).toBeVisible();

  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page).toHaveURL(
    /\/games\/nba-bos-nyk-2026-04-21\/markets\/bos-moneyline$/
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Boston moneyline" })
  ).toBeVisible();
});

test("tracked games page opens the top signal", async ({ page }) => {
  await page.goto("/games");
  await expect(
    page.getByRole("heading", { name: "Live NBA research slate" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Signal" }).first().click();
  await expect(page).toHaveURL(
    /\/games\/nba-bos-nyk-2026-04-21\/markets\/bos-moneyline$/
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Boston moneyline" })
  ).toBeVisible();
  await expect(
    page.getByText("Comparative signal is live on this market.")
  ).toBeVisible();
});

test("top instrument flow opens raw source inspection", async ({ page }) => {
  await page.goto("/games");

  await page.getByRole("link", { name: "Signal" }).first().click();
  await expect(page).toHaveURL(
    /\/games\/nba-bos-nyk-2026-04-21\/markets\/bos-moneyline$/
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Boston moneyline" })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Inspect raw source payloads" })
    .click();
  const rawDialog = page.getByRole("dialog", { name: "Raw source inspection" });
  await expect(rawDialog).toBeVisible();
  await expect(
    rawDialog.getByText("Latest raw payload", { exact: true })
  ).toBeVisible();
  await expect(
    page.locator(".recharts-cartesian-axis-line").first()
  ).toHaveAttribute("stroke", "#a9b8c7");
  await expect(
    rawDialog.getByRole("heading", { level: 2, name: "bet365" })
  ).toBeVisible();
});

test("divergence explorer shows instrument-first disagreement", async ({
  page,
}) => {
  await page.goto("/divergence");
  await expect(
    page.getByRole("heading", { name: "Instrument-first disagreement" })
  ).toBeVisible();
});

test("research page shows closed-game signal quality", async ({ page }) => {
  await page.goto("/research");
  await expect(
    page.getByRole("heading", {
      name: "How much signal is in prediction markets vs the book?",
    })
  ).toBeVisible();
  await expect(page.getByText("Per-source signal quality")).toBeVisible();
});

test("settings page queues admin actions", async ({ page }) => {
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { name: "Source and readiness status" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Restart all capture" }).click();
  await expect(page.getByText("Restart queued for all sources")).toBeVisible();
});
