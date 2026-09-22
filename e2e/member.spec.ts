import { expect, test } from '@playwright/test';

const username = process.env.E2E_FINANCIAL_USERNAME;
const password = process.env.E2E_FINANCIAL_PASSWORD;

test.beforeEach(() => {
  if (!username || !password)
    throw new Error('As credenciais E2E do membro não estão disponíveis.');
});

test('membro consulta o painel pessoal e os rankings da equipa', async ({
  page,
}) => {
  const categoryName = `Painel E2E ${Date.now().toString(36)}`;
  const note = `Histórico ${Date.now().toString(36)}`;
  await page.goto('/entrar');
  await page.getByLabel('Username').fill(username!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await page.getByRole('link', { name: 'Multas' }).click();
  await page.getByLabel('Nome').fill(categoryName);
  await page.getByLabel('Valor base (€)').fill('0,10');
  await page.getByLabel('Ordem').fill('99');
  await page.getByRole('button', { name: 'Guardar categoria' }).click();
  const ownOption = await page
    .getByRole('option', { name: /Tesoureiro E2E/ })
    .getAttribute('value');
  const categoryOption = await page
    .getByRole('option', { name: new RegExp(categoryName) })
    .getAttribute('value');
  if (!ownOption || !categoryOption)
    throw new Error('Dados E2E do membro não encontrados.');
  await page.getByLabel('Membro').selectOption(ownOption);
  await page.getByLabel('Categoria').selectOption(categoryOption);
  await page.getByLabel('Observação').fill(note);
  await page
    .getByRole('button', { name: 'Ver cálculo antes de confirmar' })
    .click();
  await expect(page.getByText(/multiplicador: 2x/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar aplicação' }).click();
  await expect(page.getByText(/Multa aplicada: 0,20/)).toBeVisible();

  await page.getByRole('link', { name: 'Painel' }).click();
  await expect(
    page.getByRole('heading', { name: 'O meu painel' }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'O meu painel' }),
  ).toBeVisible();
  await expect(page.getByText('Equipa técnica · Teste Auth')).toBeVisible();
  const personalFine = page.getByRole('listitem').filter({
    hasText: categoryName,
  });
  await expect(personalFine).toContainText('Pendente');
  await expect(personalFine).toContainText('Valor base0,10');
  await expect(personalFine).toContainText('Multiplicador2x');
  await expect(personalFine).toContainText(note);
  await expect(personalFine).toContainText('0,20');

  await page.getByRole('link', { name: 'Mural' }).click();
  await expect(
    page.getByRole('heading', { name: 'Mural da Vergonha' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Mais multas' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Maior valor acumulado' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Maior dívida atual' }),
  ).toBeVisible();
  await expect(
    page.getByRole('main').getByText('Tesoureiro E2E').first(),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText(username!);
  await expect(page.locator('body')).not.toContainText('Super Admin');
});
