import { expect, test, type Page } from "@playwright/test";

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on("pageerror", (e) => messages.push(e.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("anatomy-canvas")).toHaveAttribute(
    "data-body-loaded",
    "true",
  );
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.locator(".intro-demo")).toBeHidden();
  await page.getByRole("button", { name: "Reset camera", exact: true }).click();
  await expect
    .poll(async () =>
      Number(
        await page
          .getByTestId("anatomy-canvas")
          .getAttribute("data-camera-distance"),
      ),
    )
    .toBeGreaterThan(6);
  await page
    .getByRole("button", { name: "Pause simulation", exact: true })
    .click();
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});

async function meshPoint(page: Page, site: string) {
  const scene = page.getByTestId("anatomy-canvas"),
    rect = (await scene.boundingBox())!;
  const marker = page.getByRole("button", {
    name: `Select ${site} on body`,
    exact: true,
  });
  return {
    x: rect.x + Number(await marker.getAttribute("data-mesh-x")),
    y: rect.y + Number(await marker.getAttribute("data-mesh-y")),
  };
}

async function waitForProjection(page: Page, site: string) {
  const scene = page.getByTestId("anatomy-canvas");
  const marker = page.getByRole("button", {
    name: `Select ${site} on body`,
    exact: true,
    includeHidden: true,
  });
  const snapshot = async () => {
    const bounds = (await scene.boundingBox())!;
    return JSON.stringify({
      width: bounds.width,
      height: bounds.height,
      camera: await scene.getAttribute("data-camera-position"),
      target: await scene.getAttribute("data-camera-target"),
      x: await marker.getAttribute("data-mesh-x"),
      y: await marker.getAttribute("data-mesh-y"),
    });
  };
  await expect
    .poll(async () => {
      const before = await snapshot();
      // Software rendering updates at 250ms. Observe across two possible frames
      // so a newly resized portrait canvas cannot reuse desktop projections.
      await page.waitForTimeout(550);
      return before === (await snapshot());
    })
    .toBe(true);
}

for (const site of ["Temple", "Top of wrist"])
  test(`scrolled phone pinch holds the ${site} under the fingers while zooming and panning`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    const scene = page.getByTestId("anatomy-canvas");
    // The collapsed phone workspace fits on screen. Expand real signal
    // content so this test exercises gestures with a document scroll offset.
    await page
      .getByRole("button", { name: "Signal details ↑", exact: true })
      .click();
    await expect(page.locator("#signal-workspace")).toHaveClass(
      /mobile-signal-expanded/,
    );
    // Finish any intro framing and resize projection before resetting in the
    // actual phone viewport, then measure only the settled mobile geometry.
    await waitForProjection(page, site);
    await page
      .getByRole("button", { name: "Reset camera", exact: true })
      .click();
    // Frame the head below the floating mobile controls before touching it.
    // These are the same zoom controls available to a phone user.
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await page.getByRole("button", { name: "Zoom out", exact: true }).click();
    await waitForProjection(page, site);
    await page.evaluate(() => window.scrollTo(0, 0));
    const unscrolled = await meshPoint(page, site);
    const mobileControls = (await page
      .locator(".mobile-adjust-bar")
      .boundingBox())!;
    expect(unscrolled.y).toBeGreaterThan(
      mobileControls.y + mobileControls.height + 12,
    );
    const originalSceneTop = (await scene.boundingBox())!.y;
    // The current mobile scene begins at document y=0 beneath its floating
    // header. Scroll by a real positive offset while keeping the touched body
    // site in view; a fixed 100px minimum would put the temple above the screen.
    const scrollOffset = Math.min(120, unscrolled.y - 24);
    expect(scrollOffset).toBeGreaterThan(0);
    await page.evaluate((offset) => window.scrollTo(0, offset), scrollOffset);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeCloseTo(scrollOffset, 0);
    expect((await scene.boundingBox())!.y).toBeCloseTo(
      originalSceneTop - scrollOffset,
      0,
    );
    const initial = await meshPoint(page, site);
    expect(initial.y).toBeGreaterThanOrEqual(23);
    const before = Number(await scene.getAttribute("data-camera-distance"));
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setTouchEmulationEnabled", {
      enabled: true,
      maxTouchPoints: 2,
    });
    const points = (spread: number, shift: number) => [
      { x: initial.x - spread + shift, y: initial.y, id: 0 },
      { x: initial.x + spread + shift, y: initial.y, id: 1 },
    ];
    expect(
      await scene.evaluate(
        (element, touches) =>
          touches.every(({ x, y }) =>
            element.contains(document.elementFromPoint(x, y)),
          ),
        points(18, 0),
      ),
    ).toBe(true);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: points(18, 0),
    });
    await expect(scene).toHaveAttribute("data-zoom-anchor-source", "surface");
    const anchor = await scene.getAttribute("data-zoom-anchor-world");
    for (let i = 1; i <= 8; i++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: points(18 + i * 3, -i * 1.5),
      });
      await page.waitForTimeout(25);
      const observed = await meshPoint(page, site);
      expect(
        Math.hypot(observed.x - (initial.x - i * 1.5), observed.y - initial.y),
      ).toBeLessThan(8);
      expect(await scene.getAttribute("data-zoom-anchor-world")).toBe(anchor);
    }
    // Lift and replace a finger without ending the gesture. This must preserve
    // the normal camera controls when both fingers are finally lifted.
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [points(42, -12)[0]],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: points(42, -12),
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    expect(
      Number(await scene.getAttribute("data-camera-distance")),
    ).toBeLessThan(before * 0.55);
    const released = await meshPoint(page, site);
    await page.waitForTimeout(350);
    const settled = await meshPoint(page, site);
    expect(
      Math.hypot(settled.x - released.x, settled.y - released.y),
    ).toBeLessThan(1);
    await expect(scene).toHaveAttribute("data-device-focus", "none");
    await expect(
      page.getByRole("combobox", { name: "Wearable location", exact: true }),
    ).toHaveValue("wrist");
    // A fresh drag still orbits after the pinch has ended.
    const position = (await scene.getAttribute("data-camera-position"))!;
    const box = (await scene.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4, {
      steps: 5,
    });
    await page.mouse.up();
    await expect(scene).not.toHaveAttribute("data-camera-position", position);
    await client.detach();
  });

test("trackpad ctrl-wheel zoom anchors the head after scrolling and zooms back out cleanly", async ({
  page,
}) => {
  const scene = page.getByTestId("anatomy-canvas");
  await scene.scrollIntoViewIfNeeded();
  const initial = await meshPoint(page, "Temple");
  const client = await page.context().newCDPSession(page);
  const before = Number(await scene.getAttribute("data-camera-distance"));
  for (let i = 0; i < 4; i++) {
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: initial.x,
      y: initial.y,
      deltaX: 0,
      deltaY: -22,
      modifiers: 2,
    });
    await page.waitForTimeout(30);
    const current = await meshPoint(page, "Temple");
    expect(
      Math.hypot(current.x - initial.x, current.y - initial.y),
    ).toBeLessThan(8);
  }
  expect(Number(await scene.getAttribute("data-camera-distance"))).toBeLessThan(
    before * 0.6,
  );
  await expect(scene).toHaveAttribute("data-zoom-anchor-source", "surface");
  for (let i = 0; i < 4; i++)
    await client.send("Input.dispatchMouseEvent", {
      type: "mouseWheel",
      x: initial.x,
      y: initial.y,
      deltaX: 0,
      deltaY: 22,
      modifiers: 2,
    });
  await page.waitForTimeout(350);
  const end = await meshPoint(page, "Temple");
  expect(Math.hypot(end.x - initial.x, end.y - initial.y)).toBeLessThan(2);
  await client.detach();
});
