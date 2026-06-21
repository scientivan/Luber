import { expect, test } from "@playwright/test";

test("check console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", err => errors.push(err.message));
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");
  await page.waitForTimeout(1000);

  if (errors.length > 0) {
    throw new Error("Console errors found:\\n" + errors.join("\\n"));
  }
});
