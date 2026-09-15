import { readFile } from 'node:fs/promises';
import path from 'node:path';

const projectRefPattern = /^[a-z0-9]{20}$/;

export function validateTestProjectReference(
  expectedProjectRef,
  linkedProjectRef,
) {
  const expected = expectedProjectRef?.trim();
  const linked = linkedProjectRef?.trim();

  if (!expected) {
    throw new Error(
      'SUPABASE_TEST_PROJECT_REF é obrigatória para testes remotos. Define explicitamente a referência de um projeto Supabase descartável e exclusivo para testes.',
    );
  }

  if (!projectRefPattern.test(expected)) {
    throw new Error(
      'SUPABASE_TEST_PROJECT_REF não contém uma referência válida.',
    );
  }

  if (!projectRefPattern.test(linked ?? '')) {
    throw new Error(
      'A referência guardada em supabase/.temp/project-ref é inválida ou está ausente.',
    );
  }

  if (expected !== linked) {
    throw new Error(
      'SUPABASE_TEST_PROJECT_REF não coincide com supabase/.temp/project-ref. A execução remota foi recusada antes de aceder ao projeto.',
    );
  }

  return expected;
}

export async function requireLinkedTestProject(projectDirectory) {
  const projectRefFile = path.join(
    projectDirectory,
    'supabase',
    '.temp',
    'project-ref',
  );
  let linkedProjectRef;

  try {
    linkedProjectRef = await readFile(projectRefFile, 'utf8');
  } catch {
    throw new Error(
      'Não foi possível ler supabase/.temp/project-ref. Liga primeiro o projeto Supabase descartável de testes.',
    );
  }

  return validateTestProjectReference(
    process.env.SUPABASE_TEST_PROJECT_REF,
    linkedProjectRef,
  );
}
