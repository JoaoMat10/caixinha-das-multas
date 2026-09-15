import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertNoStrandedAdminTestOwners,
  cleanupAdminTestOwner,
  cleanupAuthTestUser,
  cleanupStrandedAdminTestOwners,
  prepareAdminTestOwner,
  prepareAuthTestUser,
} from './supabase-auth-test-fixture.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(currentDirectory, '..');
let testUser;
let testOwner;
let testError;
const cleanupErrors = [];

function runNode(entryPoint, argumentsList, environment) {
  return spawnSync(process.execPath, [entryPoint, ...argumentsList], {
    cwd: projectDirectory,
    env: { ...process.env, ...environment },
    stdio: 'inherit',
  });
}

try {
  await cleanupStrandedAdminTestOwners();
  testUser = await prepareAuthTestUser();
  testOwner = await prepareAdminTestOwner();
  const environment = {
    VITE_SUPABASE_URL: testUser.configuration.url,
    VITE_SUPABASE_PUBLISHABLE_KEY: testUser.configuration.publishableKey,
    E2E_AUTH_USERNAME: testUser.username,
    E2E_AUTH_PASSWORD: testUser.password,
    E2E_ADMIN_USERNAME: testOwner.username,
    E2E_ADMIN_PASSWORD: testOwner.password,
  };

  const build = runNode(
    path.join(projectDirectory, 'node_modules', 'vite', 'bin', 'vite.js'),
    ['build'],
    environment,
  );
  if (build.status !== 0) process.exitCode = build.status ?? 1;

  if (!process.exitCode) {
    const playwright = runNode(
      path.join(projectDirectory, 'node_modules', 'playwright', 'cli.js'),
      ['test'],
      environment,
    );
    if (playwright.status !== 0) process.exitCode = playwright.status ?? 1;
  }
} catch (error) {
  testError = error;
} finally {
  for (const cleanup of [
    () => cleanupAdminTestOwner(testOwner),
    () => cleanupAuthTestUser(testUser),
    () => assertNoStrandedAdminTestOwners(),
  ]) {
    try {
      await cleanup();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
}

if (cleanupErrors.length > 0) {
  throw new AggregateError(
    testError ? [testError, ...cleanupErrors] : cleanupErrors,
    'A limpeza dos dados E2E temporários falhou.',
  );
}
if (testError) {
  throw testError;
}
