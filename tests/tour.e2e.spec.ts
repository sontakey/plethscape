import { test, expect } from "@playwright/test";
for (const width of [1440, 390])
  test(`guided experiments remain interactive at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    const scene = page.getByTestId("anatomy-canvas");
    await expect(scene).toHaveAttribute("data-body-loaded", "true");
    await expect(scene).toHaveAttribute("data-region-focus", "wrist");
    await expect
      .poll(async () =>
        Number(await scene.getAttribute("data-camera-distance")),
      )
      .toBeLessThan(width >= 1100 ? 6.5 : 4.5);
    if (width < 701) {
      await page.getByRole("button", { name: "Open menu", exact: true }).click();
      await page
        .getByRole("button", { name: "Learn through exploration", exact: true })
        .click();
    } else {
      await page.getByRole("button", { name: "Learn", exact: true }).click();
    }
    await page.getByRole("button", { name: "Start guided tour" }).click();
    const card = page.getByRole("region", { name: "Guided experiment" });
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(card).toBeVisible();
    await card
      .getByRole("button", { name: "Follow a pulse", exact: true })
      .click();
    await expect(card.getByRole("status")).toContainText("deliberately slowed");
    for (const [label, action, value] of [
      ["Location", "Compare the finger", "finger"],
      ["Age", "Try age 70", "70"],
      ["Rate", "Try 120 bpm", "120"],
      ["Breathing", "Try 6 breaths/min", "6"],
    ]) {
      await card
        .getByRole("button", { name: `Go to ${label} experiment` })
        .click();
      await card.getByRole("button", { name: action, exact: true }).click();
      await expect(card.getByRole("status")).not.toContainText("You changed");
      await expect(card.getByRole("status")).not.toContainText(
        "Change the highlighted",
      );
      if (label === "Location")
        await expect(scene).toHaveAttribute("data-flow-focus", value);
      else
        await expect(
          page.getByRole("slider", {
            name:
              label === "Age"
                ? "Age"
                : label === "Rate"
                  ? "Heart rate"
                  : "Breathing rate",
            exact: true,
            includeHidden: true,
          }),
        ).toHaveValue(value);
    }
    await page
      .getByRole("button", { name: "Pause simulation", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Resume simulation", exact: true }),
    ).toBeVisible();
    await card.getByRole("button", { name: "Go to Age experiment" }).click();
    if (width < 701)
      await page.getByRole("button", { name: "Adjust physiology" }).click();
    await page.getByRole("slider", { name: "Age", exact: true }).fill("70");
    if (width < 701)
      await page.getByRole("button", { name: "See the signal →" }).click();
    await expect(card.getByRole("status")).toContainText("Only age changed");
    await card.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/tour-${width}.png` });
    await card.getByRole("button", { name: "Exit guided tour" }).click();
    await expect(card).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
  });

test("wearable selection frames a region and flows without forcing close inspection", async ({
  page,
}) => {
  await page.goto("/");
  const scene = page.getByTestId("anatomy-canvas");
  await expect(scene).toHaveAttribute("data-body-loaded", "true");
  for (const [name, id] of [
    ["Sensor band", "wrist"],
    ["Temple sensor", "forehead"],
    ["Toe band", "toe"],
  ]) {
    await page
      .getByRole("button", { name: `Select ${name}`, exact: true })
      .click();
    await expect(scene).toHaveAttribute("data-region-focus", id);
    await expect(scene).toHaveAttribute("data-flow-focus", id);
    await page.waitForTimeout(1000);
    const d = Number(await scene.getAttribute("data-camera-distance"));
    // Regional framing stays outside the sub-unit device-inspection close-up.
    // The current wide-stage targets settle around 1.4 to 1.9 by site.
    expect(d).toBeGreaterThan(1);
    expect(d).toBeLessThan(6.5);
    await expect(scene).toHaveAttribute("data-device-focus", "none");
  }
  await page
    .getByRole("button", { name: "Select Sensor band", exact: true })
    .click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "artifacts/wrist-region.png" });
});
