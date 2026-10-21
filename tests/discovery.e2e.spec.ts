import { expect, test, type Page } from "@playwright/test";
const errorsByPage = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
    "data-body-loaded",
    "true",
  );
});
test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page)).toEqual([]);
});

test("workspace starts at the wrist with controls and both signal views", async ({
  page,
}) => {
  await expect(
    page.getByRole("button", { name: "Workspace", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("button", { name: "Select Sensor band", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const name of [
    "Age",
    "Heart rate",
    "Arterial stiffness",
    "Breathing rate",
  ])
    await expect(page.getByRole("slider", { name, exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: /^Synthetic streaming PPG/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /^Synthetic single-cycle PPG/ }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Save reference", exact: true })
    .click();
  await page.getByRole("slider", { name: "Age", exact: true }).fill("70");
  await expect(page.locator(".signal-change-note")).toContainText(
    "Age changes",
  );
  await expect(
    page.getByRole("img", { name: /^Synthetic streaming PPG/ }),
  ).toHaveAttribute("aria-label", /Dashed purple/);
  // The signal remains in the viewport while lower controls scroll in their own rail.
  await page
    .getByRole("slider", { name: "Breathing rate", exact: true })
    .fill("8");
  const rect = await page.locator(".signal-chart").boundingBox();
  expect(rect!.y).toBeGreaterThanOrEqual(0);
  expect(rect!.y + rect!.height).toBeLessThan(1100);
});

test("optional pulse journey closes the drawer and respects pause", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  await page.getByRole("button", { name: "Start guided tour" }).click();
  await page
    .getByRole("region", { name: "Guided experiment" })
    .getByRole("button", { name: "Follow a pulse", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  const scene = page.getByTestId("anatomy-canvas");
  await page.waitForTimeout(120);
  const frozen = await scene.getAttribute("data-journey-progress");
  await page.waitForTimeout(250);
  expect(await scene.getAttribute("data-journey-progress")).toBe(frozen);
  await page
    .getByRole("button", { name: "Resume simulation", exact: true })
    .click();
  await expect
    .poll(async () => Number(await scene.getAttribute("data-journey-progress")))
    .toBeGreaterThan(Number(frozen));
});

test("guided age experiment changes the actual workspace and preserves its reference", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  await page
    .getByRole("button", { name: "Read a heartbeat", exact: true })
    .click();
  await page.getByRole("button", { name: "Age 75", exact: true }).click();
  await page
    .getByRole("button", { name: "Try in Workspace", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("slider", { name: "Age", exact: true }),
  ).toHaveValue("75");
  await page.getByRole("slider", { name: "Age", exact: true }).fill("70");
  await expect(
    page.getByRole("button", { name: "Back to lesson", exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to lesson", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "The science", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What is a PPG signal?", exact: true }),
  ).toBeVisible();
});

test("location selection frames nearby anatomy and anatomy controls remain secondary", async ({
  page,
}) => {
  const scene = page.getByTestId("anatomy-canvas");
  await page
    .getByRole("button", { name: "Select Sensor earring", exact: true })
    .click();
  await expect(scene).toHaveAttribute("data-region-focus", "ear");
  await expect(scene).toHaveAttribute("data-device-focus", "none");
  await page.getByRole("button", { name: "View options", exact: true }).click();
  const nerves = page.getByRole("switch", {
    name: "Nervous system",
    exact: true,
  });
  await nerves.click();
  await expect(nerves).toHaveAttribute("aria-checked", "false");
  await page
    .getByRole("button", { name: "Close view options", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Select Sensor earring", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

for (const width of [360, 820])
  test(`workspace, charts and drawer fit at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(width);
    if (width < 701)
      await page.getByRole("button", { name: "Adjust physiology" }).click();
    for (const name of [
      "Age",
      "Heart rate",
      "Arterial stiffness",
      "Breathing rate",
    ])
      await expect(
        page.getByRole("slider", { name, exact: true }),
      ).toBeVisible();
    if (width < 701)
      await page.getByRole("button", { name: "See the signal →" }).click();
    const plot = page.getByRole("img", { name: /^Synthetic streaming PPG/ });
    await plot.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        plot.evaluate((node) => {
          const c = node as HTMLCanvasElement;
          return c
            .getContext("2d")!
            .getImageData(0, 0, c.width, c.height)
            .data.some((v, i) => i % 4 === 3 && v > 0);
        }),
      )
      .toBe(true);
    if (width < 701) {
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Learn through exploration" })
        .click();
    } else {
      await page.getByRole("button", { name: "Learn", exact: true }).click();
    }
    await expect(page.getByRole("dialog")).toBeVisible();
    const header = page.locator("dialog.learning-page .learning-navigation");
    await expect(
      header.getByRole("combobox", { name: "Appearance", exact: true }),
    ).toBeVisible();
    for (const name of ["Back to ChatPPG", "Plethscape home"])
      await expect(
        header.getByRole("link", { name, exact: true }),
      ).toBeVisible();
    const headerGeometry = await header.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        top: bounds.top,
        bottom: bounds.bottom,
        left: bounds.left,
        right: bounds.right,
        controls: Array.from(element.querySelectorAll("a, select")).map(
          (control) => {
            const rect = control.getBoundingClientRect();
            return {
              top: rect.top,
              bottom: rect.bottom,
              left: rect.left,
              right: rect.right,
            };
          },
        ),
      };
    });
    expect(headerGeometry.top).toBeGreaterThanOrEqual(0);
    expect(headerGeometry.right).toBeLessThanOrEqual(width);
    for (const control of headerGeometry.controls) {
      expect(control.top).toBeGreaterThanOrEqual(headerGeometry.top);
      expect(control.bottom).toBeLessThanOrEqual(headerGeometry.bottom);
      expect(control.left).toBeGreaterThanOrEqual(headerGeometry.left);
      expect(control.right).toBeLessThanOrEqual(headerGeometry.right);
    }
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(width);
    await page.screenshot({ path: info.outputPath(`learn-${width}.png`) });
  });
