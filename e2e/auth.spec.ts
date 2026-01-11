import { test, expect, type Page } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL ?? 'demo@example.com';
const password = process.env.E2E_USER_PASSWORD ?? 'password';

async function signIn(page: Page) {
  await page.goto('/login');

  // あなたのUIは見出しが "Login" なので、まずログインページを確実に踏んだことを確認
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);

  await page.getByRole('button', { name: /log in|login|sign in/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await expect
    .poll(async () => {
      const res = await page.request.get("/api/me");
      return res.status();
    }, { timeout: 20_000 })
    .toBe(200);
}

test('未ログインで /dashboard → /login に飛ぶ', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login(\?|$)/);
});

test('ログインするとセッションが作られる', async ({ page }) => {
  await signIn(page);
});

test('ログイン後は /dashboard が見える', async ({ page }) => {
  await signIn(page);

  // 成功時に自動遷移しない実装でも、ここで明示的に /dashboard へ行く
  await page.goto('/dashboard');

  // ここは「dashboardページ固有のテキスト」に寄せるのが最強
  // ひとまずURLが dashboard であることを検証
  await expect(page).toHaveURL(/\/dashboard/);

  // さらに固有の要素があるならそれを見る（例: data-testid）
  // await expect(page.getByTestId('dashboard-root')).toBeVisible();
});
