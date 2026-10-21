import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reviewUrl = process.env.PLETHSCAPE_REVIEW_URL ?? "/";
const artifactRoot = path.resolve(
  process.env.PLETHSCAPE_REVIEW_ARTIFACTS ??
    "artifacts/mobile-workspace-2026-10-21",
);
type Appearance = "light" | "dark";
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 568, height: 320 },
  { width: 667, height: 375 },
  { width: 844, height: 390 },
] as const;
const themes: Appearance[] = ["light", "dark"];
const plot = (page: Page) =>
  page.locator(".signal-section > .signal-chart canvas");
const simulationTime = async (page: Page) =>
  Number(
    await page
      .getByTestId("anatomy-canvas")
      .getAttribute("data-simulation-time"),
  );

test.use({ actionTimeout: 30_000 });
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
    await testInfo.attach("workspace-layout", {
      body: JSON.stringify(await layoutSnapshot(page), null, 2),
      contentType: "application/json",
    });
  }
  expect(browserErrors.get(page), "Uncaught browser errors").toEqual([]);
});

async function ready(page: Page, theme: Appearance) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    (appearance) => localStorage.setItem("plethscape-appearance", appearance),
    theme,
  );
  await page.goto(reviewUrl);
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
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(anatomy).toHaveAttribute("data-theme", theme);
  await page.evaluate(() => document.fonts.ready);
  const viewport = page.viewportSize()!;
  const directory = path.join(
    artifactRoot,
    `${theme}-${viewport.width}x${viewport.height}`,
  );
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "before-explore-layout.json"),
    JSON.stringify(await layoutSnapshot(page), null, 2),
  );
  const explore = page.getByRole("button", { name: "Explore", exact: true });
  if (await explore.isVisible()) await explore.click();
  await expect(page.locator(".intro-demo")).toBeHidden();
  await expect(plot(page)).toBeVisible();
}

async function pause(page: Page) {
  const pauseButton = page.getByRole("button", {
    name: "Pause simulation",
    exact: true,
  });
  if (await pauseButton.isVisible()) await pauseButton.click();
  await expect(
    page.getByRole("button", { name: "Resume simulation", exact: true }),
  ).toBeVisible();
  // Software WebGL may publish the last live frame on its next 250ms tick.
  let previous = -1;
  await expect
    .poll(
      async () => {
        const time = await simulationTime(page);
        const settled = time === previous;
        previous = time;
        return settled;
      },
      { intervals: [300] },
    )
    .toBe(true);
}

async function layoutSnapshot(page: Page) {
  return page.evaluate(() => {
    const bounds = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      };
    };
    const styles = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        display: style.display,
        position: style.position,
        height: style.height,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        gridTemplateRows: style.gridTemplateRows,
        gridTemplateColumns: style.gridTemplateColumns,
        gridArea: style.gridArea,
        mobileHeaderHeight: style.getPropertyValue("--mobile-header-height"),
      };
    };
    const anatomy = document.querySelector<HTMLElement>(
      '[data-testid="anatomy-canvas"]',
    );
    const chart = document.querySelector<HTMLCanvasElement>(
      ".signal-section > .signal-chart canvas",
    );
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scrollY,
      documentWidth: document.documentElement.scrollWidth,
      theme: document.documentElement.dataset.theme,
      header: bounds(".app-shell > .app-header"),
      main: bounds(".app-shell > main"),
      workspace: bounds(".workspace-viewport"),
      lab: bounds(".lab-workspace"),
      body: bounds(".body-panel"),
      footer: bounds(".app-footer"),
      intro: bounds(".intro-demo"),
      layoutStyles: {
        main: styles(".app-shell > main"),
        workspace: styles(".workspace-viewport"),
        lab: styles(".lab-workspace"),
        body: styles(".body-panel"),
        intro: styles(".intro-demo"),
      },
      controls: bounds(".mobile-adjust-bar"),
      anatomy: bounds('[data-testid="anatomy-canvas"] > canvas'),
      toolbar: bounds(".body-panel .scene-toolbar"),
      chart: bounds(".signal-section > .signal-chart canvas"),
      signal: bounds(".signal-panel"),
      bodyLoaded: anatomy?.dataset.bodyLoaded,
      anatomySource: anatomy?.dataset.anatomySource,
      drawCalls: Number(anatomy?.dataset.drawCalls ?? 0),
      chartBitmap: chart ? { width: chart.width, height: chart.height } : null,
    };
  });
}

type Layout = Awaited<ReturnType<typeof layoutSnapshot>>;
function layoutFailures(layout: Layout) {
  const failures: string[] = [];
  const tolerance = 1;
  for (const name of [
    "header",
    "controls",
    "anatomy",
    "toolbar",
    "chart",
  ] as const) {
    const rect = layout[name];
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      failures.push(`${name}: missing or empty rectangle`);
      continue;
    }
    if (
      rect.x < -tolerance ||
      rect.y < -tolerance ||
      rect.right > layout.viewport.width + tolerance ||
      rect.bottom > layout.viewport.height + tolerance
    )
      failures.push(`${name}: outside viewport ${JSON.stringify(rect)}`);
  }
  if (
    layout.header &&
    layout.controls &&
    layout.header.bottom > layout.controls.y + tolerance
  )
    failures.push("Header overlaps the location/physiology controls");
  if (
    layout.anatomy &&
    layout.header &&
    layout.header.bottom > layout.anatomy.y + tolerance
  )
    failures.push("Header overlaps the anatomy canvas");
  if (
    layout.anatomy &&
    layout.controls &&
    layout.controls.bottom > layout.anatomy.y + tolerance
  )
    failures.push("Location/physiology controls overlap the anatomy canvas");
  if (
    layout.anatomy &&
    layout.toolbar &&
    layout.anatomy.bottom > layout.toolbar.y + tolerance
  )
    failures.push("Anatomy canvas extends behind its toolbar");
  if (!layout.chart || layout.chart.height < 150 - tolerance)
    failures.push(
      `Actual chart canvas is shorter than 150px: ${layout.chart?.height}`,
    );
  if (layout.chart && layout.anatomy) {
    const overlapWidth =
      Math.min(layout.chart.right, layout.anatomy.right) -
      Math.max(layout.chart.x, layout.anatomy.x);
    const overlapHeight =
      Math.min(layout.chart.bottom, layout.anatomy.bottom) -
      Math.max(layout.chart.y, layout.anatomy.y);
    if (overlapWidth > tolerance && overlapHeight > tolerance)
      failures.push("Anatomy canvas and waveform overlap");
  }
  if (layout.documentWidth > layout.viewport.width + tolerance)
    failures.push(`Horizontal overflow: ${layout.documentWidth}px`);
  if (Math.abs(layout.scrollY) > tolerance)
    failures.push(
      `Workspace requires vertical scrolling: scrollY=${layout.scrollY}`,
    );
  if (!layout.chartBitmap?.width || !layout.chartBitmap.height)
    failures.push("Chart has no drawing buffer");
  if (
    layout.bodyLoaded !== "true" ||
    layout.anatomySource !== "BodyParts3D 4.0" ||
    layout.drawCalls <= 0
  )
    failures.push("Real BodyParts3D anatomy has not rendered");
  return failures;
}

async function expectCompactWorkspace(page: Page, returnFromExpanded = false) {
  // Secondary studies/footer intentionally scroll. Initial workspace checks
  // never move the viewport, so browser autoscroll cannot hide a layout defect.
  if (returnFromExpanded) await page.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(async () => layoutFailures(await layoutSnapshot(page)))
    .toEqual([]);
  return layoutSnapshot(page);
}

async function expandSignal(page: Page) {
  await page
    .getByRole("button", { name: "Signal details ↑", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Minimize signal ↓", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
}

async function minimizeSignal(page: Page) {
  const minimize = page.getByRole("button", {
    name: "Minimize signal ↓",
    exact: true,
  });
  if (await minimize.isVisible()) await minimize.click();
  await expect(
    page.getByRole("button", { name: "Signal details ↑", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
}

async function canvasPixels(canvas: Locator) {
  return canvas.evaluate((node: HTMLCanvasElement) => node.toDataURL());
}

async function cameraState(page: Page) {
  const scene = page.getByTestId("anatomy-canvas");
  return {
    distance: Number(await scene.getAttribute("data-camera-distance")),
    target: (await scene.getAttribute("data-camera-target"))
      ?.split(",")
      .map(Number),
    position: (await scene.getAttribute("data-camera-position"))
      ?.split(",")
      .map(Number),
  };
}

async function expectFullBodyCamera(page: Page) {
  await expect
    .poll(async () => (await cameraState(page)).distance)
    .toBeCloseTo(Math.hypot(0.12, 0.05, 6.45), 3);
  const camera = await cameraState(page);
  [0, 1.82, 0].forEach((value, index) =>
    expect(camera.target?.[index]).toBeCloseTo(value, 4),
  );
  return camera;
}

async function settledCamera(page: Page) {
  let previous = "";
  let matchingSamples = 0;
  await expect
    .poll(
      async () => {
        const camera = await cameraState(page);
        const sample = JSON.stringify(camera);
        matchingSamples = sample === previous ? matchingSamples + 1 : 0;
        previous = sample;
        return matchingSamples;
      },
      { intervals: [300] },
    )
    .toBeGreaterThanOrEqual(3);
  return cameraState(page);
}

for (const theme of themes) {
  for (const viewport of viewports) {
    test(`mobile workspace ${theme} ${viewport.width}x${viewport.height} fits real anatomy and waveform`, async ({
      page,
    }) => {
      test.setTimeout(150_000);
      await page.setViewportSize(viewport);
      await ready(page, theme);
      await pause(page);
      const initialCamera = await expectFullBodyCamera(page);
      const initialLayout = await expectCompactWorkspace(page);
      await page
        .getByRole("button", { name: "Reset camera", exact: true })
        .click();
      await expectFullBodyCamera(page);
      const layout = await expectCompactWorkspace(page);
      const directory = path.join(
        artifactRoot,
        `${theme}-${viewport.width}x${viewport.height}`,
      );
      await mkdir(directory, { recursive: true });
      // A viewport capture proves that no scrolling or stitched image is needed.
      await page.screenshot({
        path: path.join(directory, "workspace.png"),
        fullPage: false,
      });
      await writeFile(
        path.join(directory, "layout.json"),
        JSON.stringify(
          {
            url: page.url(),
            initialCamera,
            initialLayout,
            ...layout,
            errors: browserErrors.get(page),
          },
          null,
          2,
        ),
      );
    });
  }

  test(`mobile workspace ${theme} retains controls and returns from expanded studies`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await ready(page, theme);
    await pause(page);
    const frozen = await simulationTime(page);
    const location = page.getByRole("combobox", {
      name: "Wearable location",
      exact: true,
    });
    await location.selectOption("finger");
    await expect(location).toHaveValue("finger");
    await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
      "data-flow-focus",
      "finger",
    );
    await expect(plot(page)).toHaveAttribute("aria-label", /at the finger/);
    await expect
      .poll(async () => (await cameraState(page)).distance)
      .toBeLessThan(6);
    await page
      .getByRole("button", { name: "Reset camera", exact: true })
      .click();
    await expectFullBodyCamera(page);
    await location.selectOption("finger");
    await expect
      .poll(async () => (await cameraState(page)).distance)
      .toBeLessThan(6);
    const selectedCamera = await settledCamera(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await expectCompactWorkspace(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const resizedCamera = await settledCamera(page);
    selectedCamera.position!.forEach((value, index) =>
      expect(resizedCamera.position?.[index]).toBeCloseTo(value, 6),
    );
    await expectCompactWorkspace(page);

    await expandSignal(page);
    await page
      .getByRole("button", { name: "Save reference", exact: true })
      .click();
    await expect(page.locator(".baseline-button")).toContainText(
      "Index finger",
    );
    await plot(page).scrollIntoViewIfNeeded();
    const beforePhysiology = await canvasPixels(plot(page));
    await page
      .getByRole("button", { name: "Adjust physiology", exact: true })
      .click();
    const drawer = page.getByRole("dialog", {
      name: "Adjust physiology",
      exact: true,
    });
    await drawer.getByRole("slider", { name: "Age", exact: true }).fill("64");
    await drawer
      .getByRole("slider", { name: "Heart rate", exact: true })
      .fill("108");
    await drawer
      .getByRole("button", { name: "See the signal →", exact: true })
      .click();
    await expect(drawer).toBeHidden();
    await plot(page).scrollIntoViewIfNeeded();
    await expect
      .poll(() => canvasPixels(plot(page)))
      .not.toBe(beforePhysiology);
    await expect(plot(page)).toHaveAttribute(
      "aria-label",
      /Dashed purple trace/,
    );
    await expect(page.locator(".baseline-button")).toContainText("32y");
    await expect(
      page.getByRole("button", { name: "Resume simulation", exact: true }),
    ).toBeVisible();
    expect(
      await simulationTime(page),
      "Physiology and site edits preserve a paused clock",
    ).toBe(frozen);
    await minimizeSignal(page);
    await expectCompactWorkspace(page, true);

    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    const menu = page.getByRole("dialog", {
      name: "Explore Plethscape",
      exact: true,
    });
    await menu
      .getByRole("combobox", { name: "Appearance", exact: true })
      .selectOption(theme === "light" ? "dark" : "light");
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      theme === "light" ? "dark" : "light",
    );
    await menu
      .getByRole("combobox", { name: "Appearance", exact: true })
      .selectOption(theme);
    await menu
      .getByRole("button", { name: "Learn through exploration", exact: true })
      .click();
    const learn = page.locator("dialog.learning-page");
    await expect(learn).toBeVisible();
    await learn
      .getByRole("combobox", { name: "Chapter", exact: true })
      .selectOption("pulse");
    await expect(
      learn.getByRole("heading", { name: "Read a heartbeat", exact: true }),
    ).toBeVisible();
    // The host gives this same navigation action a different accessible name.
    await learn
      .locator('nav[aria-label="Main navigation"] button')
      .first()
      .click();
    await expect(learn).toBeHidden();
    await expect(location).toHaveValue("finger");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const themedCamera = await cameraState(page);
    selectedCamera.position!.forEach((value, index) =>
      expect(themedCamera.position?.[index]).toBeCloseTo(value, 6),
    );
    await expectCompactWorkspace(page);

    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await menu.getByRole("button", { name: "Immerse", exact: true }).click();
    await expect(page.locator(".app-shell")).toHaveClass(/scene-only/);
    await expect(page.locator(".signal-panel")).toBeHidden();
    await expect(page.getByTestId("anatomy-canvas")).toBeInViewport();
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await menu
      .getByRole("button", { name: "Show controls", exact: true })
      .click();
    await expect(page.locator(".app-shell")).not.toHaveClass(/scene-only/);
    await expectCompactWorkspace(page);

    await expandSignal(page);
    await page
      .getByRole("button", { name: "Compare locations", exact: true })
      .click();
    await expect(page.locator(".studio-trace")).toHaveCount(3);
    await page
      .getByRole("button", { name: "Inside sensor", exact: true })
      .click();
    const optical = page.getByTestId("optical-canvas");
    await optical.scrollIntoViewIfNeeded();
    await expect(optical).toHaveAttribute("data-wavelength", "green");
    const capturedTime = await optical.getAttribute("data-time");
    await page
      .getByRole("slider", { name: "Scrub the heartbeat", exact: true })
      .fill("500");
    await optical.scrollIntoViewIfNeeded();
    await expect(optical).not.toHaveAttribute("data-time", capturedTime!);
    await page
      .getByRole("button", {
        name: "Return to live exploration ↗",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Pause simulation", exact: true }),
    ).toBeVisible();
    await pause(page);
    await minimizeSignal(page);
    await expectCompactWorkspace(page, true);

    // Keeping the overview in one screen must not make the footer unreachable.
    await page
      .locator(".app-footer")
      .getByRole("button", { name: /Model & sources/ })
      .click();
    const sources = page.getByRole("dialog", {
      name: "The science behind the signal",
      exact: true,
    });
    await expect(sources).toBeVisible();
    await sources
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await expectCompactWorkspace(page, true);
  });
}
