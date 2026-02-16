import { test, expect } from "@playwright/test";

test("shows consent banner and opens blend modal", async ({ page }) => {
  await page.goto("/playwright/consent");

  const banner = page.getByTestId("consent-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("Cross-chamber blending needs explicit consent.");

  await page.getByTestId("open-blend-modal").click();
  const modal = page.getByTestId("blend-consent-modal");
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("Ursie — Consent Required");

  await page.getByRole("button", { name: "Not now" }).click();
  await expect(modal).toHaveCount(0);
});

test("records blend approval state", async ({ page }) => {
  await page.goto("/playwright/consent");

  await page.getByTestId("open-blend-modal").click();
  await page.getByRole("button", { name: "Approve Blend" }).click();

  const approved = page.getByTestId("blend-approved");
  await expect(approved).toBeVisible();
  await expect(approved).toContainText("Blend consent recorded");
});
