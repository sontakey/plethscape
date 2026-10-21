import { test, expect } from "@playwright/test";

test("desktop typography, selected wearable and visible advanced controls", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Export signal" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "Advanced Settings" }),
  ).toBeVisible();
  await expect(page.locator(".body-panel .selected-device-card")).toHaveCount(
    0,
  );
  await expect(page.locator(".selected-site-panel")).toContainText(
    "Sensor band",
  );
  await expect(
    page.getByRole("button", { name: "Inspect device" }),
  ).toBeEnabled({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.locator("h1").evaluate((e) => getComputedStyle(e).fontFamily),
  ).toContain("DM Sans");
  await page.screenshot({ path: "artifacts/layout-desktop.png" });
});

test("mobile leads with body and signal and keeps settings in a usable drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Adjust physiology" }),
  ).toBeVisible();
  await expect(page.locator(".desktop-physiology")).toBeHidden();
  await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
    "data-body-loaded",
    "true",
  );
  await expect(page.locator("#signal-workspace")).toBeVisible();
  const body = await page.locator(".body-panel").boundingBox();
  const signal = await page.locator(".signal-panel").last().boundingBox();
  expect(body!.y).toBeLessThan(signal!.y);
  await expect(page.locator(".control-rail")).toBeHidden();
  await page
    .getByRole("combobox", { name: "Wearable location" })
    .selectOption("finger");
  await expect(page.locator(".signal-header")).toContainText("Index finger");
  await page.getByRole("button", { name: "Adjust physiology" }).click();
  const dialog = page.getByRole("dialog", { name: "Adjust physiology" });
  await expect(
    dialog.getByRole("heading", { name: "Advanced Settings" }),
  ).toBeVisible();
  await dialog.getByRole("slider", { name: "Age", exact: true }).fill("65");
  await expect(
    dialog.getByRole("slider", { name: "Age", exact: true }),
  ).toHaveValue("65");
  await page.screenshot({ path: "artifacts/layout-mobile-settings.png" });
  await dialog.getByRole("button", { name: "See the signal →" }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "artifacts/layout-mobile.png",
    fullPage: true,
  });
});
