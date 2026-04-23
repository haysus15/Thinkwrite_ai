import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
  },
  webServer: {
    command: 'NEXT_PUBLIC_E2E=true npm run dev -- --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: false,
  },
});
