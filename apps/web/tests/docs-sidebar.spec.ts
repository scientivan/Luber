import { expect, test } from "@playwright/test";

test("docs sidebar tracks active section while scrolling", async ({ page }) => {
  await page.goto("/docs");

  const gettingStartedLink = page.getByRole("link", { name: "Getting Started" });
  const installationLink = page.getByRole("link", { name: "Installation" });
  const securityLink = page.getByRole("link", { name: "Security Model" });

  await expect(page.getByRole("link", { name: "Introduction", exact: true })).toHaveAttribute("aria-current", "location");

  await page.locator("#installation").scrollIntoViewIfNeeded();
  await expect(installationLink).toHaveAttribute("aria-current", "location");

  await page.locator("#security").scrollIntoViewIfNeeded();
  await expect(securityLink).toHaveAttribute("aria-current", "location");

  await page.locator("#getting-started").scrollIntoViewIfNeeded();
  await expect(gettingStartedLink).toHaveAttribute("aria-current", "location");
});
