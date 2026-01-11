import { test, expect, type Page } from "@playwright/test";

const userEmail = process.env.E2E_USER_EMAIL ?? "demo@example.com";
const userPassword = process.env.E2E_USER_PASSWORD ?? "password";
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log in|login|sign in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await expect
    .poll(async () => {
      const res = await page.request.get("/api/me");
      return res.status();
    }, { timeout: 20_000 })
    .toBe(200);
}

test("user: profile page shows list button only", async ({ page }) => {
  await signIn(page, userEmail, userPassword);
  await page.goto("/dashboard/profile");
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Profile list" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Profile edit" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Profile create" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Profile delete" })).toHaveCount(0);
});

test("user: profile list is accessible", async ({ page }) => {
  await signIn(page, userEmail, userPassword);
  await page.goto("/dashboard/profile/profile-list");
  await expect(page.getByRole("heading", { name: "Profile list" })).toBeVisible();
  await expect(page.getByText("forbidden")).toHaveCount(0);
});

test("user: profile edit/create/delete show forbidden", async ({ page }) => {
  await signIn(page, userEmail, userPassword);

  await page.goto("/dashboard/profile/profile-edit");
  await expect(page.getByText("forbidden")).toBeVisible();

  await page.goto("/dashboard/profile/profile-create");
  await expect(page.getByText("forbidden")).toBeVisible();

  await page.goto("/dashboard/profile/profile-delete");
  await expect(page.getByText("forbidden")).toBeVisible();
});

test.describe("admin profile pages", () => {
  test.skip(!adminEmail || !adminPassword, "admin credentials not set");

  test("admin: profile page shows admin buttons", async ({ page }) => {
    await signIn(page, adminEmail!, adminPassword!);
    await page.goto("/dashboard/profile");
    await expect(page.getByRole("link", { name: "Profile edit" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Profile create" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Profile delete" })).toBeVisible();
  });

  test("admin: profile list is accessible", async ({ page }) => {
    await signIn(page, adminEmail!, adminPassword!);
    await page.goto("/dashboard/profile/profile-list");
    await expect(page.getByRole("heading", { name: "Profile list" })).toBeVisible();
    await expect(page.getByText("forbidden")).toHaveCount(0);
  });
});
