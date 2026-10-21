import { expect, test, type Locator, type Page } from "@playwright/test";

// This suite exercises a release URL only when the caller explicitly supplies
// it. It never navigates to the local development fallback automatically.
const releaseUrl = process.env.PLETHSCAPE_REVIEW_URL;
test.skip(!releaseUrl, "Supply PLETHSCAPE_REVIEW_URL for release verification");
test.use({ actionTimeout: 30_000 });

const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page), "Uncaught release browser errors").toEqual(
    [],
  );
});

const livePlot = (page: Page) => page.locator(".signal-section canvas").first();
const pixels = (canvas: Locator) =>
  canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());

async function ready(page: Page) {
  await page.goto(releaseUrl!);
  const anatomy = page.getByTestId("anatomy-canvas");
  await expect(anatomy).toHaveAttribute("data-body-loaded", "true", {
    timeout: 90_000,
  });
  await expect(anatomy).toHaveAttribute(
    "data-anatomy-source",
    "BodyParts3D 4.0",
  );
  await expect
    .poll(async () => Number(await anatomy.getAttribute("data-draw-calls")))
    .toBeGreaterThan(0);
  const explore = page.getByRole("button", { name: "Explore", exact: true });
  if (await explore.isVisible()) await explore.click();
  await expect(page.locator(".intro-demo")).toBeHidden();
  await expect(livePlot(page)).toBeVisible();
  return anatomy;
}

async function expandSignal(page: Page) {
  const expand = page.getByRole("button", {
    name: "Signal details ↑",
    exact: true,
  });
  if (await expand.isVisible()) await expand.click();
}

async function openLearn(page: Page) {
  const menu = page.getByRole("button", { name: "Open menu", exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    await page
      .getByRole("button", { name: "Learn through exploration", exact: true })
      .click();
  } else await page.getByRole("button", { name: "Learn", exact: true }).click();
  const learn = page.locator("dialog.learning-page");
  await expect(learn).toBeVisible();
  return learn;
}

test("release desktop workspace changes sites, physiology, wavelengths, rhythms and camera", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  const anatomy = await ready(page);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  for (const [device, site] of [
    ["Smart ring", "finger"],
    ["Sensor earring", "ear"],
    ["Temple sensor", "forehead"],
    ["Neck patch", "carotid"],
    ["Bicep band", "upperarm"],
    ["Toe band", "toe"],
    ["Sensor band", "wrist"],
  ]) {
    const select = page.getByRole("button", {
      name: `Select ${device}`,
      exact: true,
    });
    await select.click();
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await expect(anatomy).toHaveAttribute("data-flow-focus", site);
    await expect(anatomy).toHaveAttribute("data-device-focus", "none");
  }
  await page
    .getByRole("button", { name: "Save reference", exact: true })
    .click();
  const before = await pixels(livePlot(page));
  await page.getByRole("slider", { name: "Age", exact: true }).fill("64");
  await page
    .getByRole("slider", { name: "Heart rate", exact: true })
    .fill("110");
  await expect.poll(() => pixels(livePlot(page))).not.toBe(before);
  await expect(livePlot(page)).toHaveAttribute(
    "aria-label",
    /Dashed purple trace/,
  );
  await expect(page.locator(".baseline-button")).toContainText("32y");
  const wavelengths = page
    .locator(".signal-section")
    .getByRole("group", { name: "Light wavelength", exact: true });
  for (const name of ["Red", "Infrared", "Green"]) {
    const button = wavelengths.getByRole("button", {
      name: new RegExp(`^${name}`),
    });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(livePlot(page)).toHaveAttribute(
      "aria-label",
      new RegExp(`${name} light`),
    );
  }
  await page.locator(".rhythm-lab > summary").click();
  const rhythms = page.getByRole("group", {
    name: "Simulated rhythm",
    exact: true,
  });
  for (const [label, id] of [
    ["AFib", "afib"],
    ["PVCs", "pvc"],
    ["Sinus", "sinus"],
  ]) {
    await rhythms
      .getByRole("button", { name: new RegExp(`^${label} `) })
      .click();
    await expect(page.getByTestId("live-physiology")).toHaveAttribute(
      "data-rhythm",
      id,
    );
  }
  // Selecting a rhythm has always returned the workspace to a running stream.
  await expect(
    page.getByRole("button", { name: "Pause simulation", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(
    page.getByRole("slider", { name: "Heart rate", exact: true }),
  ).toHaveValue("142");
  await expect(
    page.getByRole("img", { name: /^Simulated three-axis accelerometer/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rest", exact: true }).click();
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
  await page.getByRole("button", { name: "Reset camera", exact: true }).click();
  // Camera telemetry is published on the next rendered frame.
  await expect
    .poll(async () =>
      Number(await anatomy.getAttribute("data-camera-distance")),
    )
    .toBeGreaterThan(6);
  const distance = Number(await anatomy.getAttribute("data-camera-distance"));
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await expect
    .poll(async () =>
      Number(await anatomy.getAttribute("data-camera-distance")),
    )
    .toBeGreaterThan(distance);
  await expect(
    page.getByRole("button", { name: "Resume simulation", exact: true }),
  ).toBeVisible();
});

test("release captured beat preserves comparison, optical wavelength, seeking and replay", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  const anatomy = await ready(page);
  await page
    .getByRole("button", { name: "Compare locations", exact: true })
    .click();
  await expect(page.locator(".studio-trace")).toHaveCount(3);
  const finger = page.getByTestId("site-trace-finger");
  const arrival = await finger.locator("path").getAttribute("d");
  await page
    .getByRole("button", { name: "Align pulse feet", exact: true })
    .click();
  await expect(finger).toHaveAttribute("aria-label", /aligned by onset/);
  expect(await finger.locator("path").getAttribute("d")).not.toBe(arrival);
  await page
    .getByRole("button", { name: "Arrival timing", exact: true })
    .click();
  await expect(finger.locator("path")).toHaveAttribute("d", arrival!);
  await page
    .getByRole("button", { name: "Inside sensor", exact: true })
    .click();
  const optical = page.getByTestId("optical-canvas");
  await optical.scrollIntoViewIfNeeded();
  await expect(optical).toHaveAttribute("data-wavelength", "green");
  const origin = Number(await optical.getAttribute("data-time"));
  await page
    .getByRole("button", { name: "Jump to Systolic peak", exact: true })
    .click();
  await optical.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => Number(await optical.getAttribute("data-time")))
    .toBeGreaterThan(origin);
  const peak = await optical.getAttribute("data-time");
  const greenPulse = await optical.getAttribute("data-pulse");
  await page
    .locator(".studio-bands")
    .getByRole("button", { name: /^Infrared/ })
    .click();
  await optical.scrollIntoViewIfNeeded();
  await expect(optical).toHaveAttribute("data-wavelength", "infrared");
  await expect(optical).toHaveAttribute("data-time", peak!);
  await expect(optical).not.toHaveAttribute("data-pulse", greenPulse!);
  await page.getByRole("button", { name: "Whole body", exact: true }).click();
  await anatomy.scrollIntoViewIfNeeded();
  await expect(anatomy).toHaveAttribute("data-simulation-time", peak!);
  const scrub = page.getByRole("slider", {
    name: "Scrub the heartbeat",
    exact: true,
  });
  await scrub.press("Home");
  await expect(scrub).toHaveValue("0");
  await page.getByRole("button", { name: "Play beat", exact: true }).click();
  await expect
    .poll(async () => Number(await scrub.inputValue()))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause beat", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play beat", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "← Back to live", exact: true })
    .click();
  await expect(livePlot(page)).toHaveAttribute(
    "aria-label",
    /^Synthetic streaming/,
  );
});

test("release phone retains location, physiology drawer, lesson experiments and source navigation", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  const location = page.getByRole("combobox", {
    name: "Wearable location",
    exact: true,
  });
  await location.selectOption("finger");
  await expect(location).toHaveValue("finger");
  await expect(livePlot(page)).toHaveAttribute("aria-label", /at the finger/);
  await page
    .getByRole("button", { name: "Adjust physiology", exact: true })
    .click();
  const drawer = page.locator("dialog.learning-drawer");
  await drawer.getByRole("slider", { name: "Age", exact: true }).fill("70");
  await drawer
    .getByRole("slider", { name: "Heart rate", exact: true })
    .fill("120");
  await drawer
    .getByRole("button", { name: "See the signal →", exact: true })
    .click();
  await expect(drawer).toBeHidden();
  await expandSignal(page);
  await page.getByRole("button", { name: "Single beat", exact: true }).click();
  await expect(livePlot(page)).toHaveAttribute(
    "aria-label",
    /^Synthetic single-cycle/,
  );
  const learn = await openLearn(page);
  await learn
    .getByRole("combobox", { name: "Chapter", exact: true })
    .selectOption("wavelengths");
  await learn.getByRole("button", { name: "Infrared", exact: true }).click();
  await expect(learn.locator(".learn-feedback")).toContainText(
    "Infrared represents deeper",
  );
  await expect(learn.locator("canvas")).toHaveAttribute(
    "aria-label",
    /Invisible infrared/,
  );
  await learn
    .getByRole("combobox", { name: "Chapter", exact: true })
    .selectOption("science");
  await learn
    .getByRole("button", { name: "View model & sources", exact: true })
    .click();
  const sources = page.getByRole("dialog", {
    name: "The science behind the signal",
    exact: true,
  });
  await expect(
    sources.getByRole("link", { name: /^BodyParts3D/ }),
  ).toBeVisible();
  await sources
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(learn).toBeVisible();
  await learn
    .getByRole("combobox", { name: "Chapter", exact: true })
    .selectOption("wavelengths");
  await learn
    .getByRole("button", { name: "Try in Workspace", exact: true })
    .click();
  await expect(learn).toBeHidden();
  await expect(livePlot(page)).toHaveAttribute("aria-label", /Infrared light/);
  await page
    .getByRole("button", { name: "Back to lesson", exact: true })
    .click();
  await expect(
    learn.getByRole("heading", {
      name: "Explore light and depth",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
