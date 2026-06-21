import { expect, test } from "@playwright/test";

test("landing documentation button opens docs page", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Read documentation" }).click();

  await expect(page).toHaveURL(/\/docs(?:#.*)?$/);
  await expect(page.getByRole("heading", { name: "Install MCP. Diagnose with agent. Approve with wallet." })).toBeVisible();
});
