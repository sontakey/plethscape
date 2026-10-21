import { test, expect } from "@playwright/test";
for (const width of [1440, 390])
  test(`location lesson links evidence to real workspace actions at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    if (width < 701) {
      await page
        .getByRole("button", { name: "Open menu", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Learn through exploration", exact: true })
        .click();
    } else {
      await page.getByRole("button", { name: "Learn", exact: true }).click();
    }
    const dialog = page.getByRole("dialog", {
      name: "Plethscape · Learn",
    });
    await dialog
      .getByRole("button", { name: /LESSON 02 Choose a wearable location/ })
      .click();
    const lesson = dialog.getByRole("region", {
      name: "Choosing a PPG location",
    });
    await expect(
      lesson.getByRole("heading", {
        name: "Where should you measure your pulse?",
      }),
    ).toBeVisible();
    await lesson.getByText("What research found", { exact: true }).click();
    await expect(
      lesson.getByRole("link", { name: /six-site study/ }),
    ).toHaveAttribute("href", /PMC6412091/);
    await lesson.getByText("What research found", { exact: true }).click();
    await dialog.screenshot({ path: `artifacts/site-lesson-${width}.png` });
    await lesson.getByRole("button", { name: /Compare wrist/ }).click();
    await expect(dialog).not.toBeVisible();
    if (width < 701) {
      await expect(
        page.getByRole("combobox", { name: "Wearable location", exact: true }),
      ).toHaveValue("wrist");
      await page.getByRole("button", { name: "Signal details ↑" }).click();
    } else {
      await expect(
        page.getByRole("button", { name: "Select Sensor band", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    await expect(
      page.getByRole("button", {
        name: "Rest",
        exact: true,
        includeHidden: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("slider", {
        name: "Heart rate",
        exact: true,
        includeHidden: true,
      }),
    ).toHaveValue("72");
    await expect(
      page.getByRole("button", {
        name: "Comparing: Index finger · 32y · 530 nm · 72 bpm · Sinus",
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Back to lesson", exact: true })
      .click();
    await expect(
      lesson.getByText("1 of 3 hands-on examples opened"),
    ).toBeVisible();
    await lesson.getByRole("button", { name: /02.*Movement/ }).click();
    await lesson.getByRole("button", { name: /Try walking/ }).click();
    await expect(
      page.getByRole("button", {
        name: "Walk",
        exact: true,
        includeHidden: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("slider", {
        name: "Heart rate",
        exact: true,
        includeHidden: true,
      }),
    ).toHaveValue("98");
    await page
      .getByRole("button", { name: "Back to lesson", exact: true })
      .click();
    await lesson.getByRole("button", { name: /03.*Everyday fit/ }).click();
    await lesson.getByRole("button", { name: "Sleep", exact: true }).click();
    await expect(lesson.getByText(/Consider overnight comfort/)).toBeVisible();
    await lesson.getByRole("button", { name: /04.*Why the wrist/ }).click();
    await expect(
      lesson.getByText(/requires comparative wear-time/),
    ).toBeVisible();
    await dialog.screenshot({
      path: `artifacts/site-lesson-wrist-${width}.png`,
    });
    expect(
      await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBeTruthy();
    await lesson
      .getByRole("button", { name: /Explore the wrist at rest/ })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Rest",
        exact: true,
        includeHidden: true,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: "Back to lesson", exact: true })
      .click();
    await expect(
      lesson.getByText("3 of 3 hands-on examples opened"),
    ).toBeVisible();
    await lesson.getByRole("button", { name: "Finish", exact: true }).click();
    await expect(
      dialog.getByRole("heading", {
        name: "Get to know the signal.",
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
