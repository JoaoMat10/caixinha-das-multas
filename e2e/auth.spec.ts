import { expect, test } from '@playwright/test';

import { expectMobileLayout } from './mobileLayout';

const username = process.env.E2E_AUTH_USERNAME;
const password = process.env.E2E_AUTH_PASSWORD;

test.beforeEach(() => {
  if (!username || !password) {
    throw new Error('As credenciais E2E efémeras não estão disponíveis.');
  }
});

test('protege rotas, recupera a sessão e permite logout', async ({
  page,
}, testInfo) => {
  await page.goto('/painel');

  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toHaveCount(0);
  if (testInfo.project.name === 'chromium-mobile') {
    await expectMobileLayout(page);
  }

  await page.getByLabel('Username').fill('utilizador.inexistente');
  await page.getByLabel('Password', { exact: true }).fill('Errada1');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Não foi possível iniciar sessão. Confirma os dados e tenta novamente.',
  );

  await page.getByLabel('Username').fill(username!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/alterar-password-obrigatoria$/);
  await expect(
    page.getByRole('heading', { name: 'Define uma nova password' }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Define uma nova password' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
});

test('o manifesto PWA inicial está disponível', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest');

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    name: 'Caixinha das Multas',
    display: 'standalone',
    lang: 'pt-PT',
  });
});
