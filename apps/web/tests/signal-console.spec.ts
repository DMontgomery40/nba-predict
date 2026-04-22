import { expect, test } from "@playwright/test";

test("tracked games page opens the game workspace", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Live NBA research slate" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Open game workspace" }).click();
  await expect(page).toHaveURL(/\/games\/nba-bos-nyk-2026-04-21$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Knicks at Celtics" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Available market feeds" })
  ).toBeVisible();
  await expect(page.getByText("Boston moneyline")).toBeVisible();
});

test("top instrument flow opens raw source inspection", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("link", { name: "Jump to top instrument" }).click();
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

test("settings page queues admin actions", async ({ page }) => {
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { name: "Source and readiness status" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Restart all capture" }).click();
  await expect(page.getByText("Restart queued for all sources")).toBeVisible();
});
