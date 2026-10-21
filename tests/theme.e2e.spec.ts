import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Long reviews need time for many screens, but a missing control should fail
// promptly rather than consuming the entire five-minute capture budget.
test.use({ actionTimeout: 30_000 });

const appearanceKey = "plethscape-appearance";
const reviewUrl = process.env.PLETHSCAPE_REVIEW_URL ?? "/";
const reviewRoot = path.resolve(
  process.env.PLETHSCAPE_REVIEW_ARTIFACTS ?? "artifacts/theme-review",
);
type Appearance = "light" | "dark";
const ppg = (page: Page) =>
  page.locator(".signal-section").getByRole("img", {
    name: /^Synthetic (streaming|single-cycle) PPG waveform/,
  });

async function hashCanvas(canvas: Locator) {
  return canvas.evaluate((node: HTMLCanvasElement) => {
    const pixels = node
      .getContext("2d")!
      .getImageData(0, 0, node.width, node.height).data;
    let hash = 2166136261;
    for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619);
    return hash >>> 0;
  });
}

async function expectAppearance(page: Page, theme: Appearance) {
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    theme === "light" ? "#fdfdfe" : "#0d0c0b",
  );
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).colorScheme,
    ),
  ).toBe(theme);
}

async function selectAppearance(page: Page, theme: Appearance) {
  const dialogSelect = page
    .locator("dialog[open]")
    .last()
    .getByRole("combobox", { name: "Appearance", exact: true });
  if (await dialogSelect.isVisible()) {
    await dialogSelect.selectOption(theme);
    await expectAppearance(page, theme);
    return;
  }
  const visibleSelect = page.locator(".appearance-control:visible select");
  if (!(await visibleSelect.count())) {
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("combobox", { name: "Appearance", exact: true })
      .selectOption(theme);
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  } else await visibleSelect.first().selectOption(theme);
  await expectAppearance(page, theme);
}

async function ready(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(reviewUrl);
  await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
    "data-body-loaded",
    "true",
    { timeout: 60_000 },
  );
  await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
    "data-anatomy-source",
    "BodyParts3D 4.0",
  );
  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId("anatomy-canvas")
          .getAttribute("data-draw-calls"),
      ),
    )
    .toBeGreaterThan(0);
  await page.evaluate(() => document.fonts.ready);
}

async function dismissIntro(page: Page) {
  const explore = page.getByRole("button", { name: "Explore", exact: true });
  if (await explore.isVisible()) await explore.click();
  await expect(page.locator(".intro-demo")).toBeHidden();
}

async function pause(page: Page) {
  const button = page.getByRole("button", {
    name: "Pause simulation",
    exact: true,
  });
  if (await button.isVisible()) await button.click();
  await expect(
    page.getByRole("button", { name: "Resume simulation", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const before = await page
        .getByTestId("anatomy-canvas")
        .getAttribute("data-simulation-time");
      await page.waitForTimeout(100);
      return (
        before ===
        (await page
          .getByTestId("anatomy-canvas")
          .getAttribute("data-simulation-time"))
      );
    })
    .toBe(true);
}

async function settledCamera(page: Page) {
  const anatomy = page.getByTestId("anatomy-canvas");
  await expect
    .poll(async () => {
      const before = await anatomy.getAttribute("data-camera-position");
      await page.waitForTimeout(250);
      return before === (await anatomy.getAttribute("data-camera-position"));
    })
    .toBe(true);
}

async function openLearn(page: Page) {
  if (
    await page
      .getByRole("button", { name: "Open menu", exact: true })
      .isVisible()
  ) {
    await page.getByRole("button", { name: "Open menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Learn through exploration", exact: true })
      .click();
  } else await page.getByRole("button", { name: "Learn", exact: true }).click();
  await expect(page.locator("dialog.learning-page")).toBeVisible();
}

const chapters = [
  ["overview", "Start here", "Get to know the signal."],
  ["pulse", "Read a heartbeat", "Read a heartbeat"],
  ["locations", "Choose a wearable location", "Choose a wearable location"],
  ["wavelengths", "Explore light and depth", "Explore light and depth"],
  ["motion", "Understand movement", "Understand movement"],
  ["science", "The science", "The science behind the pulse."],
] as const;

async function selectChapter(page: Page, chapter: (typeof chapters)[number]) {
  const learn = page.locator("dialog.learning-page");
  const mobile = learn.getByRole("combobox", { name: "Chapter", exact: true });
  if (await mobile.isVisible()) await mobile.selectOption(chapter[0]);
  else
    await learn
      .getByRole("navigation", { name: "Learning chapters", exact: true })
      .getByRole("button", { name: chapter[1], exact: true })
      .click();
  await expect(
    learn.getByRole("heading", { name: chapter[2], exact: true }),
  ).toBeVisible();
  if (
    (page.viewportSize()?.width ?? Infinity) <= 1023 &&
    !["overview", "science"].includes(chapter[0])
  ) {
    // Leave enough real plot width for annotations and axis labels on tablets.
    await expect(learn.locator(".learn-lesson-grid")).toHaveCSS(
      "grid-template-columns",
      /^[\d.]+px$/,
    );
  }
}

test.describe("theme contract", () => {
  test("fresh visits prefer light even when the OS requests dark", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto(reviewUrl);
    await expectAppearance(page, "light");
    await expect(page.locator(".desktop-appearance select")).toHaveValue(
      "light",
    );
    expect(
      await page.evaluate((key) => localStorage.getItem(key), appearanceKey),
    ).toBeNull();
  });

  test("saved dark is applied before the application module starts and persists", async ({
    page,
  }) => {
    await page.addInitScript(
      (key) => localStorage.setItem(key, "dark"),
      appearanceKey,
    );
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      (url) =>
        /\/src\/main\.tsx$|\/assets\/index-[^/]+\.js$/.test(url.pathname),
      async (route) => {
        await gate;
        await route.continue();
      },
    );
    try {
      await page.goto(reviewUrl, { waitUntil: "commit" });
      await expectAppearance(page, "dark");
      await expect(page.locator("#root > h1")).toHaveText(
        "Plethscape: Interactive PPG Waveform Simulator",
      );
      await expect(page.locator(".app-shell")).toHaveCount(0);
    } finally {
      release();
    }
    await expect(
      page.getByRole("combobox", { name: "Appearance", exact: true }),
    ).toHaveValue("dark");
  });

  test("an explicit choice survives reload and can return to light", async ({
    page,
  }) => {
    await page.goto(reviewUrl);
    await selectAppearance(page, "dark");
    expect(
      await page.evaluate((key) => localStorage.getItem(key), appearanceKey),
    ).toBe("dark");
    await page.reload();
    await expectAppearance(page, "dark");
    await selectAppearance(page, "light");
    await page.reload();
    await expectAppearance(page, "light");
  });

  test("invalid saved appearance falls back to light", async ({ page }) => {
    await page.addInitScript(
      (key) => localStorage.setItem(key, "sepia"),
      appearanceKey,
    );
    await page.goto(reviewUrl);
    await expectAppearance(page, "light");
    await selectAppearance(page, "dark");
    expect(
      await page.evaluate((key) => localStorage.getItem(key), appearanceKey),
    ).toBe("dark");
  });

  test("blocked storage keeps a light default and a working session switch", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      for (const method of ["getItem", "setItem"] as const) {
        Object.defineProperty(Storage.prototype, method, {
          value() {
            throw new DOMException(
              "Storage blocked for theme regression",
              "SecurityError",
            );
          },
        });
      }
    });
    await page.goto(reviewUrl);
    await expectAppearance(page, "light");
    await selectAppearance(page, "dark");
    await selectAppearance(page, "light");
    expect(errors).toEqual([]);
  });

  test("paused real anatomy, camera, physiology and saved reference survive both appearance changes", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await ready(page);
    await dismissIntro(page);
    await page
      .getByRole("button", { name: "Select Smart ring", exact: true })
      .click();
    await page.getByRole("slider", { name: "Age", exact: true }).fill("64");
    await page
      .getByRole("button", { name: "Save reference", exact: true })
      .click();
    await pause(page);
    await settledCamera(page);
    const anatomy = page.getByTestId("anatomy-canvas");
    const plot = ppg(page);
    const baseline = await page.locator(".baseline-button").innerText();
    const state = await anatomy.evaluate((node) =>
      Object.fromEntries(
        [
          "data-simulation-time",
          "data-camera-position",
          "data-camera-target",
          "data-camera-distance",
          "data-region-focus",
          "data-device-focus",
        ].map((name) => [name, node.getAttribute(name)]),
      ),
    );
    const expectPreservedState = async () => {
      for (const [name, value] of Object.entries(state)) {
        if (name.startsWith("data-camera-")) {
          expect(value, `${name} exists in the baseline`).not.toBeNull();
          const expected = value!.split(",").map(Number);
          // OrbitControls can round its unchanged camera by a few ULPs when
          // the theme invalidates a paused frame. Detect motion, not roundoff.
          await expect
            .poll(
              async () => {
                const raw = await anatomy.getAttribute(name);
                if (raw === null) return Infinity;
                const actual = raw.split(",").map(Number);
                if (actual.length !== expected.length) return Infinity;
                return Math.max(
                  ...actual.map((coordinate, i) =>
                    Math.abs(coordinate - expected[i]),
                  ),
                );
              },
              {
                message: `${name} remains unchanged within renderer precision`,
              },
            )
            .toBeLessThanOrEqual(1e-10);
        } else await expect(anatomy).toHaveAttribute(name, value!);
      }
    };
    const nodes = await page.evaluateHandle(() => ({
      anatomy: document.querySelector('[data-testid="anatomy-canvas"] canvas'),
      plot: document.querySelector(".signal-chart canvas"),
    }));
    const lightPixels = await hashCanvas(plot);
    await selectAppearance(page, "dark");
    await expect.poll(() => hashCanvas(plot)).not.toBe(lightPixels);
    const darkPixels = await hashCanvas(plot);
    await expectPreservedState();
    await expect(
      page.getByRole("slider", { name: "Age", exact: true }),
    ).toHaveValue("64");
    await expect(page.locator(".baseline-button")).toHaveText(baseline);
    await expect(plot).toHaveAttribute(
      "aria-label",
      /at the finger.*Dashed purple/,
    );
    expect(
      await nodes.evaluate(
        (original) =>
          original.anatomy ===
            document.querySelector('[data-testid="anatomy-canvas"] canvas') &&
          original.plot === document.querySelector(".signal-chart canvas"),
      ),
    ).toBe(true);
    await selectAppearance(page, "light");
    await expect.poll(() => hashCanvas(plot)).not.toBe(darkPixels);
    await expectPreservedState();
    await expect(
      page.getByRole("button", { name: "Resume simulation", exact: true }),
    ).toBeVisible();
    await nodes.dispose();
  });

  test("a paused lesson canvas repaints while preserving its selected experiment", async ({
    page,
  }) => {
    await page.goto(reviewUrl);
    await openLearn(page);
    await selectChapter(page, chapters[3]);
    const learn = page.locator("dialog.learning-page");
    await learn.getByRole("button", { name: "Infrared", exact: true }).click();
    const plot = learn.locator("canvas");
    await expect(plot).toHaveAttribute(
      "aria-label",
      /Invisible infrared is shown in violet false color/,
    );
    const before = await hashCanvas(plot);
    await selectAppearance(page, "dark");
    await expect.poll(() => hashCanvas(plot)).not.toBe(before);
    await expect(
      learn.getByRole("button", { name: "Infrared", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(learn).toBeVisible();
  });

  test("a captured optical beat keeps its time, wavelength and renderer when appearance changes", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await ready(page);
    await dismissIntro(page);
    await page
      .getByRole("button", { name: "Compare locations", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Inside sensor", exact: true })
      .click();
    const optical = page.getByTestId("optical-canvas");
    await expect(optical).toHaveAttribute("data-wavelength", "green");
    await page
      .getByRole("button", { name: "Jump to Systolic peak", exact: true })
      .click();
    await page
      .locator(".studio-bands")
      .getByRole("button", { name: /^Infrared/ })
      .click();
    await expect(optical).toHaveAttribute("data-wavelength", "infrared");
    const snapshot = await optical.evaluate((node) =>
      Object.fromEntries(
        [
          "data-time",
          "data-pulse",
          "data-detected-light",
          "data-wavelength",
        ].map((name) => [name, node.getAttribute(name)]),
      ),
    );
    const renderer = await optical.locator("canvas").elementHandle();
    const image = await optical.screenshot();
    await selectAppearance(page, "dark");
    await expect
      .poll(async () => image.equals(await optical.screenshot()))
      .toBe(false);
    for (const [name, value] of Object.entries(snapshot))
      await expect(optical).toHaveAttribute(name, value!);
    expect(
      await renderer!.evaluate(
        (node) =>
          node ===
          document.querySelector('[data-testid="optical-canvas"] canvas'),
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Play beat", exact: true }),
    ).toBeVisible();
    await renderer!.dispose();
  });
});

type CaptureRecord = {
  name: string;
  file: string;
  theme: string | undefined;
  documentWidth: number;
  viewportWidth: number;
  dialogs: {
    className: string;
    width: number;
    scrollWidth: number;
    left: number;
    right: number;
  }[];
  scroll?: { position: number; maximum: number; viewport: number };
};

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [
    { width: 320, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 1100 },
  ]) {
    test(`theme review: ${theme} at ${viewport.width}px covers workspace and all learning chapters`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(300_000);
      const config = `${theme}-${viewport.width}`;
      const directory = path.join(reviewRoot, config);
      await mkdir(directory, { recursive: true });
      const captures: CaptureRecord[] = [];
      const errors: string[] = [];
      const unavailableSurfaces: {
        surface: string;
        status: "not-exposed-by-host";
        reason: string;
      }[] = [];
      let completed = false;
      page.on("pageerror", (error) => errors.push(error.message));
      const capture = async (
        name: string,
        scroll?: CaptureRecord["scroll"],
      ) => {
        const file = path.join(directory, `${name}.png`);
        const metrics = await page.evaluate(() => ({
          theme: document.documentElement.dataset.theme,
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: innerWidth,
          dialogs: Array.from(
            document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
          ).map((dialog) => {
            const bounds = dialog.getBoundingClientRect();
            return {
              className: dialog.className,
              width: dialog.clientWidth,
              scrollWidth: dialog.scrollWidth,
              left: bounds.left,
              right: bounds.right,
            };
          }),
        }));
        const headers = await page
          .locator(".app-header:visible")
          .evaluateAll((elements) =>
            elements.flatMap((element) => {
              const bounds = element.getBoundingClientRect();
              if (bounds.bottom <= 0 || bounds.top >= innerHeight) return [];
              return [
                {
                  top: bounds.top,
                  bottom: bounds.bottom,
                  controls: Array.from(element.querySelectorAll("a, select"))
                    .filter((control) => {
                      const rect = control.getBoundingClientRect();
                      return rect.width > 0 && rect.height > 0;
                    })
                    .map((control) => {
                      const rect = control.getBoundingClientRect();
                      return {
                        label:
                          control.getAttribute("aria-label") ??
                          control.textContent,
                        top: rect.top,
                        bottom: rect.bottom,
                      };
                    }),
                },
              ];
            }),
          );
        for (const header of headers) {
          // A normal header may leave the viewport while its document scrolls;
          // headers at the top must contain every visible brand and selector.
          if (header.top < 0) continue;
          for (const control of header.controls) {
            expect
              .soft(control.top, `${name}: ${control.label} header top`)
              .toBeGreaterThanOrEqual(header.top);
            expect
              .soft(control.bottom, `${name}: ${control.label} header bottom`)
              .toBeLessThanOrEqual(header.bottom);
          }
        }
        await page.screenshot({ path: file, animations: "disabled" });
        captures.push({
          name,
          file,
          ...metrics,
          ...(scroll ? { scroll } : {}),
        });
        expect
          .soft(metrics.documentWidth, `${name}: document horizontal overflow`)
          .toBeLessThanOrEqual(metrics.viewportWidth + 1);
        for (const dialog of metrics.dialogs) {
          expect
            .soft(dialog.scrollWidth, `${name}: dialog horizontal overflow`)
            .toBeLessThanOrEqual(dialog.width + 1);
          expect
            .soft(dialog.left, `${name}: dialog left edge`)
            .toBeGreaterThanOrEqual(-1);
          expect
            .soft(dialog.right, `${name}: dialog right edge`)
            .toBeLessThanOrEqual(metrics.viewportWidth + 1);
        }
      };
      const captureScroll = async (name: string, locator: Locator) => {
        await expect(locator).toBeVisible();
        await locator.scrollIntoViewIfNeeded();
        // A narrow workspace scrolls the document; desktop rails and dialogs
        // scroll themselves. Capture the actual scroll owner in either layout.
        const target = await locator.evaluateHandle((node) => {
          let candidate: Element | null = node;
          while (candidate && candidate !== document.documentElement) {
            if (
              candidate.scrollHeight > candidate.clientHeight + 2 &&
              /auto|scroll/.test(getComputedStyle(candidate).overflowY)
            )
              break;
            candidate = candidate.parentElement;
          }
          return { node, scroller: candidate ?? document.scrollingElement! };
        });
        const dimensions = await target.evaluate(({ node, scroller }) => {
          const documentScroll =
            scroller === document.documentElement || scroller === document.body;
          const viewport = documentScroll ? innerHeight : scroller.clientHeight;
          const maximum = Math.max(0, scroller.scrollHeight - viewport);
          if (node === scroller) return { minimum: 0, maximum, viewport };
          const bounds = node.getBoundingClientRect();
          const ownerTop = documentScroll
            ? 0
            : scroller.getBoundingClientRect().top;
          const minimum = Math.max(
            0,
            Math.min(maximum, bounds.top - ownerTop + scroller.scrollTop - 12),
          );
          const end = Math.max(
            minimum,
            Math.min(
              maximum,
              bounds.bottom - ownerTop + scroller.scrollTop - viewport + 12,
            ),
          );
          return { minimum, maximum: end, viewport };
        });
        const positions = [dimensions.minimum];
        const step = Math.max(150, Math.floor(dimensions.viewport * 0.78));
        for (
          let position = dimensions.minimum + step;
          position < dimensions.maximum;
          position += step
        )
          positions.push(position);
        if (dimensions.maximum > dimensions.minimum + 2)
          positions.push(dimensions.maximum);
        for (const [index, position] of positions.entries()) {
          await target.evaluate(({ scroller }, top) => {
            scroller.scrollTop = top;
          }, position);
          await page.waitForTimeout(80);
          await capture(`${name}-${String(index + 1).padStart(2, "0")}`, {
            position,
            maximum: dimensions.maximum,
            viewport: dimensions.viewport,
          });
        }
        await target.evaluate(({ scroller }) => {
          scroller.scrollTop = 0;
        });
        await target.dispose();
      };
      const openDetails = async (scope: Locator) => {
        for (const summary of await scope
          .locator("details:not([open]) > summary")
          .all()) {
          if (await summary.isVisible()) await summary.click();
        }
      };
      try {
        await page.setViewportSize(viewport);
        await page.addInitScript(
          ({ key, value }) => localStorage.setItem(key, value),
          { key: appearanceKey, value: theme },
        );
        await ready(page);
        await expectAppearance(page, theme);
        await capture("workspace-onboarding");
        await dismissIntro(page);
        await page
          .getByRole("button", { name: "Reset camera", exact: true })
          .click();
        await pause(page);
        await settledCamera(page);
        await capture("workspace-full-anatomy-and-charts");

        const mobile = viewport.width <= 700;
        if (!mobile) {
          await page
            .getByRole("button", { name: "Inspect device", exact: true })
            .click();
          await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
            "data-device-focus",
            "wrist",
          );
          await settledCamera(page);
          await capture("device-inspection-on-body");
          await page
            .getByRole("button", { name: "Optical side", exact: true })
            .click();
          await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
            "data-device-isolated",
            "true",
          );
          await settledCamera(page);
          await capture("device-inspection-optical-side");
          await page
            .getByRole("button", { name: "Return to full body", exact: true })
            .click();
        }
        if (mobile) {
          await page
            .getByRole("button", { name: "Open menu", exact: true })
            .click();
          await captureScroll("mobile-menu", page.getByRole("dialog"));
          await page
            .getByRole("button", { name: "Close dialog", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Adjust physiology", exact: true })
            .click();
        }
        const controls = mobile
          ? page.locator("dialog.learning-drawer")
          : page.locator(".control-rail");
        await openDetails(controls);
        await captureScroll("physiology-and-rhythm-settings", controls);
        await controls
          .getByRole("button", { name: "View motion signals", exact: true })
          .click();
        if (mobile)
          await page
            .getByRole("button", { name: "See the signal →", exact: true })
            .click();

        await captureScroll(
          "motion-and-accelerometer",
          page.locator(".motion-panel"),
        );
        if (mobile)
          await page
            .getByRole("button", { name: "Adjust physiology", exact: true })
            .click();
        await controls
          .getByRole("button", { name: "Hide motion signals", exact: true })
          .click();
        if (mobile)
          await page
            .getByRole("button", { name: "See the signal →", exact: true })
            .click();

        if (mobile)
          await page
            .getByRole("button", { name: "Open menu", exact: true })
            .click();
        await page
          .getByRole("button", { name: "View options", exact: true })
          .click();
        await captureScroll(
          "anatomy-view-options",
          page.locator(".view-options-panel"),
        );
        await page
          .getByRole("button", { name: "Close view options", exact: true })
          .click();

        if (mobile)
          await page
            .getByRole("button", { name: "Signal details ↑", exact: true })
            .click();
        await page
          .getByRole("button", { name: "Save reference", exact: true })
          .click();
        await openDetails(page.locator("#signal-workspace"));
        await captureScroll(
          "signal-comparison-landmarks-wavelengths-recent-beats",
          page.locator("#signal-workspace"),
        );
        await page
          .getByRole("button", { name: "Normalized shape", exact: true })
          .click();
        await page.locator(".wavelength-comparison").scrollIntoViewIfNeeded();
        await capture("normalized-wavelength-comparison");
        await page
          .getByRole("button", { name: "Amplitude", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Compare locations", exact: true })
          .click();
        await expect(page.getByTestId("site-trace-wrist")).toBeVisible();
        await page.getByTestId("anatomy-canvas").scrollIntoViewIfNeeded();
        await capture("captured-beat-whole-body");
        await openDetails(page.locator(".studio-panel"));
        await captureScroll(
          "captured-beat-site-comparison",
          page.locator(".studio-panel"),
        );
        await page
          .getByRole("button", { name: "Inside sensor", exact: true })
          .click();
        const optical = page.getByTestId("optical-canvas");
        await optical.scrollIntoViewIfNeeded();
        await expect(optical).toHaveAttribute("data-wavelength", "green");
        const initialOpticalTime = await optical.getAttribute("data-time");
        await page
          .getByRole("button", { name: "Jump to Systolic peak", exact: true })
          .click();
        // The optical renderer pauses when scrolled offscreen. Return to the
        // real scene after its controls before waiting for or capturing a frame.
        await optical.scrollIntoViewIfNeeded();
        await expect(optical).not.toHaveAttribute(
          "data-time",
          initialOpticalTime!,
        );
        await capture("optical-cutaway-green");
        const infrared = page
          .locator(".studio-bands")
          .getByRole("button", { name: /^Infrared/ });
        await infrared.click();
        await expect(infrared).toHaveAttribute("aria-pressed", "true");
        await optical.scrollIntoViewIfNeeded();
        await expect(optical).toHaveAttribute("data-wavelength", "infrared");
        await capture("optical-cutaway-infrared");
        await openDetails(page.locator(".studio-panel"));
        await captureScroll(
          "captured-beat-optical-controls-and-evidence",
          page.locator(".studio-panel"),
        );
        await page
          .getByRole("button", {
            name: mobile ? "Return to live exploration ↗" : "← Back to live",
            exact: true,
          })
          .click();

        await openLearn(page);
        const learn = page.locator("dialog.learning-page");
        for (const chapter of chapters) {
          await selectChapter(page, chapter);
          if (chapter[0] === "pulse")
            await learn
              .getByRole("button", { name: "Age 75", exact: true })
              .click();
          if (chapter[0] === "wavelengths" || chapter[0] === "motion")
            await learn
              .getByRole("button", { name: "Infrared", exact: true })
              .click();
          if (chapter[0] === "motion")
            await learn
              .getByRole("button", { name: "Running", exact: true })
              .click();
          await captureScroll(`learn-${chapter[0]}`, learn);
          if (chapter[0] === "locations") {
            const lesson = learn.getByRole("region", {
              name: "Choosing a PPG location",
              exact: true,
            });
            for (const step of [
              "Signal",
              "Movement",
              "Everyday fit",
              "Why the wrist",
            ]) {
              await lesson
                .getByRole("navigation", {
                  name: "Location lesson steps",
                  exact: true,
                })
                .getByRole("button", { name: new RegExp(step) })
                .click();
              await openDetails(lesson);
              if (step === "Everyday fit")
                await lesson
                  .getByRole("button", { name: "Exercise", exact: true })
                  .click();
              await captureScroll(
                `learn-location-step-${step.toLowerCase().replaceAll(" ", "-")}`,
                lesson,
              );
            }
          }
        }
        await learn
          .getByRole("button", { name: "View model & sources", exact: true })
          .click();
        const sources = page.getByRole("dialog", {
          name: "The science behind the signal",
          exact: true,
        });
        await openDetails(sources);
        await captureScroll("model-and-sources", sources);
        await sources
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
        await expect(learn).toBeVisible();
        await selectChapter(page, chapters[0]);
        const startTour = learn.getByRole("button", {
          name: "Start guided tour",
          exact: true,
        });
        const tour = page.getByRole("region", {
          name: "Guided experiment",
          exact: true,
        });
        // The existing hosted app has no tour entry: its LearnPage has no
        // onStartTour callback, and only an already-mounted tour can set a
        // non-null tourStep. Record that baseline difference explicitly; never
        // hide a missing standalone entry or skip a reachable hosted tour.
        if (
          process.env.PLETHSCAPE_REVIEW_URL &&
          (await startTour.count()) === 0
        ) {
          await expect(startTour).toHaveCount(0);
          await expect(tour).toHaveCount(0);
          unavailableSurfaces.push({
            surface: "guided-tour",
            status: "not-exposed-by-host",
            reason:
              "The hosted LearnPage and workspace have no guided-tour entry in the existing host baseline. The tour component remains unreachable from its initial null state. No production navigation was added for this theme review.",
          });
          await capture("learn-overview-host-without-guided-tour-entry");
        } else {
          await startTour.click();
          for (const step of [
            "Follow",
            "Location",
            "Age",
            "Rate",
            "Breathing",
          ]) {
            await tour
              .getByRole("button", {
                name: `Go to ${step} experiment`,
                exact: true,
              })
              .click();
            await openDetails(tour);
            await tour.scrollIntoViewIfNeeded();
            await capture(`guided-tour-${step.toLowerCase()}`);
          }
          await tour
            .getByRole("button", { name: "Exit guided tour", exact: true })
            .click();
        }
        expect(errors, "Uncaught browser errors during visual matrix").toEqual(
          [],
        );
        completed = true;
      } finally {
        const inventory = {
          config,
          viewport,
          theme,
          reviewUrl,
          captures,
          errors,
          unavailableSurfaces,
          status: completed
            ? testInfo.errors.length === 0
              ? "passed"
              : "failed"
            : "incomplete",
          expectedStatus: testInfo.expectedStatus,
        };
        const file = path.join(directory, "inventory.json");
        await writeFile(file, JSON.stringify(inventory, null, 2) + "\n");
        await testInfo.attach(`theme-review-${config}`, {
          path: file,
          contentType: "application/json",
        });
      }
    });
  }
}
