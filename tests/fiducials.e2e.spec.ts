import { expect, test } from "@playwright/test";
for (const width of [1440, 390]) {
  test(`single beat landmarks are readable and selectable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto("/");
    await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
      "data-body-loaded",
      "true",
    );
    if (width < 701)
      await page
        .getByRole("button", { name: "Signal details ↑", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Single beat", exact: true })
      .click();
    const guide = page.getByRole("region", { name: "Pulse landmarks" });
    await expect(guide).toBeVisible();
    await expect(guide.getByRole("button")).toHaveCount(6);
    const upslope = guide.getByRole("button", {
      name: "Maximum upslope",
      exact: true,
    });
    await upslope.click();
    await expect(upslope).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#fiducial-description")).toContainText(
      "first derivative",
    );
    await guide.getByRole("button", { name: /Pulse offset/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#fiducial-description")).toContainText(
      "onset of the next",
    );
    await guide.getByText("Pulse timing & shape", { exact: true }).click();
    await expect(
      guide.getByText("Pulse width at 50% amplitude", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("img", { name: /^Synthetic single-cycle PPG/ })
      .screenshot({ path: `artifacts/landmark-chart-${width}.png` });
    await guide.screenshot({ path: `artifacts/fiducials-${width}.png` });
    await page.getByRole("button", { name: "Labels", exact: true }).click();
    await expect(guide).toHaveCount(0);
    await page.getByRole("button", { name: "Labels", exact: true }).click();
    await expect(guide).toBeVisible();
  });
}
