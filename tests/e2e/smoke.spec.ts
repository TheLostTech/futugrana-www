import { test, expect } from "@playwright/test";

test.describe("Landing IT", () => {
  test("hero renders with title + CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Le prop firm/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Inizia gratis/ }).first()).toBeVisible();
  });

  test("scrolling reveals all 4 scenes", async ({ page }) => {
    await page.goto("/");
    for (const eyebrow of ["01 — anti-breach", "02 — verità sul netto", "03 — multi-broker", "04 — contabilità"]) {
      await expect(page.locator(`text="${eyebrow}"`)).toBeVisible();
    }
  });

  test("pricing section shows 4 cards", async ({ page }) => {
    await page.goto("/");
    for (const price of ["€150", "€300", "€400", "Contattaci"]) {
      await expect(page.locator(`text="${price}"`).first()).toBeVisible();
    }
  });
});

test.describe("Routes return 200", () => {
  for (const path of ["/", "/prezzi", "/per-gestori", "/partner", "/faq", "/come-funziona", "/privacy", "/cookie", "/termini", "/blog", "/docs", "/en/", "/en/prezzi"]) {
    test(`GET ${path}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
    });
  }
});

test.describe("Cross-subdomain CTA", () => {
  test("Inizia gratis links to app.futugrana.com/signup", async ({ page }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: /Inizia gratis/ }).first();
    await expect(cta).toHaveAttribute("href", /app\.futugrana\.com\/signup/);
  });
});

test.describe("Partner calculator", () => {
  test("slider updates the annual commission text", async ({ page }) => {
    await page.goto("/partner");
    const slider = page.locator("input[type=range]");
    await expect(slider).toBeVisible();
    await slider.fill("10");
    await expect(page.locator("text=/Trader referral attivi/")).toBeVisible();
    await expect(page.locator("text=/10/").first()).toBeVisible();
  });
});
