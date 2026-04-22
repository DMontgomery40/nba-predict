import { expect, test } from "@playwright/test";

test("demo mode overview opens the event workspace", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Signal Console" })
  ).toBeVisible();
  await page
    .getByRole("link", { name: /New York @ Boston/i })
    .first()
    .click();

  await expect(page).toHaveURL(/\/events\/knicks-celtics$/);
  await expect(
    page.getByRole("button", { name: "Queue on watchlist" })
  ).toBeVisible();
});

test("settings supports replay mode selection and fixture mutation", async ({
  page,
}) => {
  await page.goto("/settings");

  await expect(
    page.getByRole("heading", { name: "Mode and fixture control" })
  ).toBeVisible();

  const replayModeCard = page.locator(".mode-grid").getByRole("button", {
    name: /replay/i,
  });
  await replayModeCard.click();
  await expect(replayModeCard).toHaveClass(/mode-card-active/);

  await page.getByRole("button", { name: "Set replay" }).first().click();
  await expect(page.getByText("Replay selection updated.")).toBeVisible();
});
