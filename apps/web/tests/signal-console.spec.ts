import { expect, test } from "@playwright/test";

test("trader desk opens the top ranked instrument", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Volatility now",
    })
  ).toBeVisible();

  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page).toHaveURL(/\/games\/[^/]+\/markets\/[^/]+$/);
  await expect(page.getByText("Market review")).toBeVisible();
});

test("tracked games page opens the top game board", async ({ page }) => {
  await page.goto("/games");
  await expect(
    page.getByRole("heading", { name: "NBA market work slate" })
  ).toBeVisible({ timeout: 15_000 });

  await page
    .getByRole("link", { name: /^(Game|Review)$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/games\/[^/]+(\/markets\/[^/]+)?$/);
});

test("top instrument flow opens raw source inspection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page).toHaveURL(/\/games\/[^/]+\/markets\/[^/]+$/);
  await expect(
    page.getByRole("button", { exact: true, name: "Source records" })
  ).toBeVisible({ timeout: 15_000 });

  await page
    .getByRole("button", { exact: true, name: "Source records" })
    .click();
  const rawDialog = page.getByRole("dialog", { name: "Source record" });
  await expect(rawDialog).toBeVisible();
  await expect(
    rawDialog.getByText("Normalized quote", { exact: true })
  ).toBeVisible();
  await expect(
    page.locator(".recharts-cartesian-axis-line").first()
  ).toHaveAttribute("stroke", "#a9b8c7");
  await expect(
    rawDialog.getByRole("heading", { level: 2 }).first()
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
      name: "How much signal is in exchange prices vs bet365?",
    })
  ).toBeVisible();
  await expect(page.getByText("Per-source signal quality")).toBeVisible();
});

test("settings page exposes admin actions", async ({ page }) => {
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { name: "Source and readiness status" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Restart all capture" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Queue game backfill" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Queue market backfill" })
  ).toBeVisible();
});
