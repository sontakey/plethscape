import { expect, test, type Page } from "@playwright/test";

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
    "data-body-loaded",
    "true",
    { timeout: 25_000 },
  );
}
async function openStudio(page: Page) {
  await ready(page);
  if (page.viewportSize()!.width < 701)
    await page.getByRole("button", { name: "Signal details ↑" }).click();
  await page
    .getByRole("button", { name: "Compare locations", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inside sensor", exact: true })
    .click();
  await expect(page.getByTestId("optical-canvas")).toHaveAttribute(
    "data-wavelength",
    "green",
  );
}
const number = async (page: Page, id: string, attr: string) =>
  Number(await page.getByTestId(id).getAttribute(attr));

test("site discovery starts at the wrist and opens anatomical comparisons directly", async ({
  page,
}) => {
  await ready(page);
  const selector = page.getByRole("group", {
    name: "Wearable location",
    exact: true,
  });
  await expect(
    selector.getByRole("button", { name: "Select Sensor band", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const previews = await selector
    .locator(".site-selector-preview svg path:not(.site-preview-axis)")
    .evaluateAll((paths) => paths.map((path) => path.getAttribute("d")));
  expect(new Set(previews).size).toBe(7);
  await page
    .getByRole("button", { name: "Compare locations", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Whole body", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const site of ["wrist", "finger", "ear"]) {
    await expect(page.getByTestId(`site-trace-${site}`)).toBeInViewport();
  }
  await page
    .getByRole("button", { name: "← Back to live", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Compare locations", exact: true }),
  ).toBeFocused();
  await page.setViewportSize({ width: 390, height: 1100 });
  const mobileLocation = page.getByRole("combobox", {
    name: "Wearable location",
    exact: true,
  });
  await mobileLocation.selectOption("toe");
  await expect(mobileLocation).toHaveValue("toe");
  await expect(
    page.getByRole("img", {
      name: /^Synthetic streaming PPG waveform at the toe/,
    }),
  ).toBeVisible();
  await expect(mobileLocation).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("captured pulse scrubs both scenes, supports fiducials and resumes live exploration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openStudio(page);
  const origin = await number(page, "optical-canvas", "data-time");
  await expect(page.getByTestId("anatomy-canvas")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Play beat", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Jump to Systolic peak", exact: true })
    .click();
  await expect
    .poll(() => number(page, "optical-canvas", "data-pulse"))
    .toBeGreaterThan(0.7);
  const peakTime = await number(page, "optical-canvas", "data-time");
  expect(peakTime).toBeGreaterThan(origin);
  const pulse = await number(page, "optical-canvas", "data-pulse");
  expect(
    await number(page, "optical-canvas", "data-detected-light"),
  ).toBeLessThan(1);
  await page.getByRole("button", { name: /^Infrared/ }).click();
  await expect(page.getByTestId("optical-canvas")).toHaveAttribute(
    "data-wavelength",
    "infrared",
  );
  expect(await number(page, "optical-canvas", "data-time")).toBe(peakTime);
  expect(await number(page, "optical-canvas", "data-pulse")).not.toBe(pulse);
  await page.getByRole("button", { name: /^Green/ }).click();
  await expect
    .poll(() => number(page, "optical-canvas", "data-pulse"))
    .toBe(pulse);
  expect(await number(page, "optical-canvas", "data-time")).toBe(peakTime);
  await page.getByRole("button", { name: "Whole body", exact: true }).click();
  await expect
    .poll(() => number(page, "anatomy-canvas", "data-simulation-time"))
    .toBe(peakTime);
  await page.getByRole("slider", { name: "Scrub the heartbeat" }).fill("100");
  await expect
    .poll(() => number(page, "anatomy-canvas", "data-simulation-time"))
    .toBeLessThan(peakTime);
  await page.getByRole("button", { name: "Play beat", exact: true }).click();
  const before = await number(page, "anatomy-canvas", "data-simulation-time");
  await expect
    .poll(() => number(page, "anatomy-canvas", "data-simulation-time"))
    .not.toBe(before);
  await page.getByRole("button", { name: "Pause beat", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play beat", exact: true }),
  ).toBeVisible();
  // The renderer can publish its final paused frame on a 250ms software cadence.
  let previousTime = -1;
  await expect
    .poll(
      async () => {
        const time = await number(
          page,
          "anatomy-canvas",
          "data-simulation-time",
        );
        const settled = time === previousTime;
        previousTime = time;
        return settled;
      },
      { intervals: [300] },
    )
    .toBe(true);
  const frozen = await number(page, "anatomy-canvas", "data-simulation-time");
  await page.waitForTimeout(300);
  expect(await number(page, "anatomy-canvas", "data-simulation-time")).toBe(
    frozen,
  );
  await page
    .getByRole("button", { name: "Return to live exploration ↗", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: /^Synthetic streaming PPG waveform/ }),
  ).toBeVisible();
  await expect
    .poll(() => number(page, "anatomy-canvas", "data-simulation-time"))
    .toBeGreaterThan(frozen);
  expect(errors).toEqual([]);
});

test("site comparison retains amplitudes while alignment removes only arrival delays", async ({
  page,
}) => {
  await openStudio(page);
  await expect(page.locator(".studio-trace")).toHaveCount(3);
  const finger = page.getByTestId("site-trace-finger");
  const original = await finger.locator("path").getAttribute("d");
  await page
    .getByRole("button", { name: "Align pulse feet", exact: true })
    .click();
  await expect(finger).toHaveAttribute("aria-label", /aligned by onset/);
  expect(await finger.locator("path").getAttribute("d")).not.toBe(original);
  await page
    .getByRole("button", { name: "Arrival timing", exact: true })
    .click();
  expect(await finger.locator("path").getAttribute("d")).toBe(original);
  await page.getByText("Choose sites", { exact: true }).click();
  await page.getByRole("checkbox", { name: "Great toe", exact: true }).check();
  await expect(page.locator(".studio-trace")).toHaveCount(4);
  await expect(
    page.getByRole("checkbox", { name: "Temple", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: "Index finger", exact: true })
    .uncheck();
  await expect(page.getByTestId("site-trace-finger")).toHaveCount(0);
  await expect(page.locator(".studio-trace.selected")).toHaveCount(1);
});

test("phone inspection, keyboard seeking and repeat entry keep a clean layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1100 });
  await openStudio(page);
  const scrubber = page.getByRole("slider", { name: "Scrub the heartbeat" });
  await scrubber.press("End");
  await expect(scrubber).toHaveValue("1000");
  await scrubber.press("Home");
  await expect(scrubber).toHaveValue("0");
  await page.getByRole("button", { name: /^Red/ }).click();
  await page.locator(".studio-optics .wavelength-evidence > summary").click();
  await expect(
    page.getByRole("link", { name: "Waveform comparison, figure 3 ↗" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Return to live exploration ↗", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare locations", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inside sensor", exact: true })
    .click();
  await expect(
    page.getByRole("img", {
      name: "Interactive 3D optical sensor and tissue cutaway",
      exact: true,
    }),
  ).toHaveCount(1);
});

test("readout updates calmly and closer plotting exposes actual recent pulse variation", async ({
  page,
}) => {
  await ready(page);
  const rate = page.getByTestId("live-heart-rate");
  await expect(rate).toHaveText(/^\d+bpm$/);
  const changes = await rate.evaluate(async (el) => {
    let count = 0;
    const observer = new MutationObserver(() => count++);
    observer.observe(el, { characterData: true, subtree: true });
    await new Promise((r) => setTimeout(r, 3100));
    observer.disconnect();
    return count;
  });
  expect(changes).toBeLessThanOrEqual(4);
  await page
    .getByRole("combobox", { name: "Time window", exact: true })
    .selectOption("2.5");
  await expect(
    page.getByRole("img", { name: /^Synthetic streaming PPG waveform/ }),
  ).toHaveAttribute("data-window-seconds", "2.5");
  await page.getByText("See beat-to-beat changes", { exact: true }).click();
  const recent = page.getByTestId("recent-beats");
  await expect(recent).toBeVisible();
  const paths = await recent
    .locator("path")
    .evaluateAll((els) => els.map((e) => e.getAttribute("d")));
  expect(new Set(paths).size).toBe(5);
  const current = await recent.getAttribute("data-event");
  await expect.poll(() => recent.getAttribute("data-event")).not.toBe(current);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page.waitForTimeout(350);
  const frozen = await recent.getAttribute("data-event");
  await page.waitForTimeout(400);
  expect(await recent.getAttribute("data-event")).toBe(frozen);
});
