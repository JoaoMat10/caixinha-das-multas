import { expect, test } from '@playwright/test';

const username = process.env.E2E_FINANCIAL_USERNAME;
const password = process.env.E2E_FINANCIAL_PASSWORD;

test.beforeEach(() => {
  if (!username || !password)
    throw new Error('As credenciais E2E da tesouraria não estão disponíveis.');
});

test('tesoureiro gere catálogo, aplica, liquida, reabre e elimina multa elegível', async ({
  page,
}, testInfo) => {
  const categoryName = `Multa E2E ${Date.now().toString(36)}`;
  await page.goto('/entrar');
  await page.getByLabel('Username').fill(username!);
  await page.getByLabel('Password').fill(password!);
  await page.getByRole('button', { name: 'Entrar' }).click();
  const treasuryLink = page.getByRole('link', {
    name: /^(Tesouraria|Caixa — navegação móvel)$/,
  });
  await expect(treasuryLink).toBeVisible();
  if (testInfo.project.name === 'chromium-mobile') {
    await page.setViewportSize({ width: 320, height: 740 });
    await expect
      .poll(() =>
        page.evaluate<number>(
          'document.documentElement.scrollWidth - document.documentElement.clientWidth',
        ),
      )
      .toBeLessThanOrEqual(0);
    await expect
      .poll(() =>
        page.evaluate<string>(
          "getComputedStyle(document.querySelector('.mobile-bottom-navigation .app-nav-link')).flexDirection",
        ),
      )
      .toBe('column');
  }
  await page.getByRole('link', { name: 'Multas' }).click();
  await expect(
    page.getByRole('heading', { name: 'Catálogo da época' }),
  ).toBeVisible();

  await page.getByLabel('Nome').fill(categoryName);
  await page.getByLabel('Valor base (€)').fill('0,10');
  await page.getByLabel('Ordem').fill('17');
  await page.getByRole('button', { name: 'Guardar categoria' }).click();
  const category = page.getByRole('listitem').filter({ hasText: categoryName });
  await expect(category).toContainText('0,10');
  await category.getByRole('button', { name: 'Editar' }).click();
  await page.getByLabel('Ordem').fill('18');
  await page.getByRole('button', { name: 'Guardar categoria' }).click();
  await expect(category).toContainText('ordem 18');
  await category.getByRole('button', { name: 'Desativar' }).click();
  await expect(category).toContainText('inativa');
  await category.getByRole('button', { name: 'Reativar' }).click();
  await expect(category).toContainText('ativa');

  const ownOption = await page
    .getByRole('option', { name: /Tesoureiro E2E/ })
    .getAttribute('value');
  if (!ownOption) throw new Error('Membro de teste não encontrado.');
  await page.getByLabel('Membro').selectOption(ownOption);
  const categoryOption = await page
    .getByRole('option', { name: new RegExp(categoryName) })
    .getAttribute('value');
  if (!categoryOption) throw new Error('Categoria de teste não encontrada.');
  await page.getByLabel('Categoria').selectOption(categoryOption);
  for (let count = 0; count < 3; count += 1) {
    await page
      .getByRole('button', { name: 'Ver cálculo antes de confirmar' })
      .click();
    await expect(page.getByText(/multiplicador: 2x/)).toBeVisible();
    await expect(page.getByText(/Total: 0,20/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar aplicação' }).click();
    await expect(page.getByText(/Multa aplicada: 0,20/)).toBeVisible();
  }

  await treasuryLink.click();
  const ownFines = page.getByRole('listitem').filter({ hasText: categoryName });
  await expect(ownFines).toHaveCount(3);
  await ownFines
    .getByRole('button', { name: 'Marcar como paga' })
    .first()
    .click();
  const settleDialog = page.getByRole('dialog', {
    name: 'Marcar multa como paga?',
  });
  await expect(settleDialog).toBeVisible();
  await settleDialog.getByRole('button', { name: 'Marcar como paga' }).click();
  await expect(page.getByText(/Multa marcada como paga: 0,20/)).toBeVisible();

  await page.getByLabel('Membro').selectOption(ownOption);
  const selectors = ownFines.getByRole('checkbox', {
    name: /Selecionar multa/,
  });
  await expect(selectors).toHaveCount(2);
  await selectors.nth(0).check();
  await expect(
    page.getByText(/1 multa\(s\) pendente\(s\) selecionada\(s\) · 0,20/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Liquidar seleção' }).click();
  await expect(
    page.getByText(/Total calculado pelo servidor: 0,20/),
  ).toBeVisible();
  await ownFines.getByRole('button', { name: 'Reabrir' }).first().click();
  const reopenDialog = page.getByRole('dialog', { name: 'Reabrir multa?' });
  await expect(reopenDialog).toBeVisible();
  await reopenDialog.getByRole('button', { name: 'Reabrir multa' }).click();
  await expect(
    page.getByText(/Valor retirado do recebido: 0,20/),
  ).toBeVisible();
  await expect(ownFines.getByRole('button', { name: 'Eliminar' })).toHaveCount(
    1,
  );
  await ownFines.getByRole('button', { name: 'Eliminar' }).click();
  const removeDialog = page.getByRole('dialog', { name: 'Eliminar multa?' });
  await expect(removeDialog).toBeVisible();
  await removeDialog.getByRole('button', { name: 'Eliminar multa' }).click();
  await expect(page.getByText('Multa pendente eliminada.')).toBeVisible();
  await expect(
    ownFines.getByRole('checkbox', { name: /Selecionar multa/ }),
  ).toHaveCount(1);
});
