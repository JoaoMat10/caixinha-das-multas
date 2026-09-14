import { chromium, defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

const systemChrome = path.join(
  process.env.ProgramFiles ?? 'C:\\Program Files',
  'Google',
  'Chrome',
  'Application',
  'chrome.exe',
);
const installedPlaywrightChromium = path.join(
  process.env.LOCALAPPDATA ?? '',
  'ms-playwright',
  'chromium-1105',
  'chrome-win',
  'chrome.exe',
);
const browserExecutable = existsSync(installedPlaywrightChromium)
  ? installedPlaywrightChromium
  : existsSync(systemChrome)
    ? systemChrome
    : chromium.executablePath();

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: { executablePath: browserExecutable },
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `"${process.execPath}" ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173`,
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
