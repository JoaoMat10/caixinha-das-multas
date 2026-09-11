import { expect, test } from '@playwright/test';

test('o shell arranca e permite navegar entre placeholders', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: 'A base está pronta para entrar em campo.',
    }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Mural' }).click();

  await expect(page).toHaveURL(/\/mural$/);
  await expect(
    page.getByRole('heading', { name: 'Mural reservado para os rankings' }),
  ).toBeVisible();
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
