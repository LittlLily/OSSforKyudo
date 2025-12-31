import { test, expect, type Page } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL ?? 'demo@example.com';
const password = process.env.E2E_USER_PASSWORD ?? 'password1234!';

async function signIn(page: Page) {
  await page.goto('/login');

  // あなたのUIは見出しが "Login" なので、まずログインページを確実に踏んだことを確認
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);

  await page.getByRole('button', { name: /log in|login|sign in/i }).click();

  // 「ログイン成功＝cookieが生えた」を最優先で確認する
  await expect
    .poll(async () => {
      const cookies = await page.context().cookies();
      return cookies.some((c) => c.name.includes('sb-') || c.name.includes('supabase'));
    }, { timeout: 10_000 })
    .toBeTruthy();
}

test('未ログインで /protected → /login に飛ぶ', async ({ page }) => {
  await page.goto('/protected');
  await expect(page).toHaveURL(/\/login(\?|$)/);
});

test('ログインするとセッションが作られる', async ({ page }) => {
  await signIn(page);
});

test('ログイン後は /protected が見える', async ({ page }) => {
  await signIn(page);

  // 成功時に自動遷移しない実装でも、ここで明示的に /protected へ行く
  await page.goto('/protected');

  // ここは「protectedページ固有のテキスト」に寄せるのが最強
  // ひとまずURLが protected であることを検証
  await expect(page).toHaveURL(/\/protected/);

  // さらに固有の要素があるならそれを見る（例: data-testid）
  // await expect(page.getByTestId('protected-root')).toBeVisible();
});
