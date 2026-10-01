import { expect, test } from '@playwright/test';

import { expectMobileLayout } from './mobileLayout';

const username = process.env.E2E_ADMIN_USERNAME;
const password = process.env.E2E_ADMIN_PASSWORD;

test.beforeEach(() => {
  if (!username || !password)
    throw new Error('As credenciais E2E do Owner não estão disponíveis.');
});

test('Owner abre a Administração e cria uma conta temporária', async ({
  page,
}, testInfo) => {
  await page.goto('/entrar');
  await page.getByLabel('Username').fill(username!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/administracao$/);
  await expect(
    page.getByRole('heading', { name: 'Administração' }),
  ).toBeVisible();
  if (testInfo.project.name === 'chromium-mobile') {
    await expectMobileLayout(page);
  }

  await page.getByRole('button', { name: 'Utilizadores' }).click();
  const suffix = Date.now().toString(36);
  const managedUsername = `e2e.${suffix}`;
  await page.getByLabel('Username').fill(managedUsername);
  await page.getByLabel('Nome apresentado').fill('Utilizador E2E Admin');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(
    page.getByText('Password temporária — mostrar uma vez'),
  ).toBeVisible();
  const createdUser = page
    .getByRole('listitem')
    .filter({ hasText: `@${managedUsername}` });
  await expect(createdUser.getByText('Utilizador E2E Admin')).toBeVisible();

  const imagePage = await page.context().newPage();
  await imagePage.setViewportSize({ width: 1600, height: 800 });
  await imagePage.setContent(
    '<div style="width:1600px;height:800px;background:linear-gradient(135deg,#102a43,#f0b429)"></div>',
  );
  const sourceBytes = await imagePage.screenshot({
    clip: { x: 0, y: 0, width: 1600, height: 800 },
  });
  await imagePage.close();
  const uploadRequestPromise = page.waitForRequest(
    (request) =>
      request.method() === 'POST' &&
      request.url().includes('/storage/v1/object/private-photos/users/'),
  );
  await createdUser.locator('input[type="file"]').setInputFiles({
    name: 'fotografia-grande.png',
    mimeType: 'image/png',
    buffer: sourceBytes,
  });
  const uploadRequest = await uploadRequestPromise;
  await expect(createdUser.getByText('Com fotografia')).toBeVisible();
  const uploadHeaders = await uploadRequest.allHeaders();
  const storedPhoto = await page.request.get(uploadRequest.url(), {
    headers: {
      apikey: uploadHeaders.apikey,
      authorization: uploadHeaders.authorization,
    },
  });
  expect(storedPhoto.ok()).toBe(true);
  const uploadedBytes = await storedPhoto.body();
  expect(uploadedBytes.readUInt32BE(16)).toBe(1024);
  expect(uploadedBytes.readUInt32BE(20)).toBe(512);
  await createdUser.getByRole('button', { name: 'Remover foto' }).click();
  await expect(createdUser.getByText('Sem fotografia')).toBeVisible();

  await page.getByRole('button', { name: 'Auditoria' }).click();
  await expect(page.getByText('Utilizador criado').first()).toBeVisible();
});
