import { expect, test } from '@playwright/test';

const username = process.env.E2E_ADMIN_USERNAME;
const password = process.env.E2E_ADMIN_PASSWORD;

test.beforeEach(() => {
  if (!username || !password)
    throw new Error('As credenciais E2E do Owner não estão disponíveis.');
});

test('Owner abre a Administração e cria uma conta temporária', async ({
  page,
}) => {
  await page.goto('/entrar');
  await page.getByLabel('Username').fill(username!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('link', { name: 'Administração' })).toBeVisible();
  await page.getByRole('link', { name: 'Administração' }).click();
  await expect(
    page.getByRole('heading', { name: 'Administração' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Utilizadores' }).click();
  const suffix = Date.now().toString(36);
  await page.getByLabel('Username').fill(`e2e.${suffix}`);
  await page.getByLabel('Nome apresentado').fill('Utilizador E2E Admin');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(
    page.getByText('Password temporária — mostrar uma vez'),
  ).toBeVisible();
  await expect(page.getByText('Utilizador E2E Admin')).toBeVisible();

  await page.getByRole('button', { name: 'Auditoria' }).click();
  await expect(page.getByText('Utilizador criado').first()).toBeVisible();
});
