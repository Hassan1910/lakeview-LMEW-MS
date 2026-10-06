import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: './node_modules/.bin/vite --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174/login',
    reuseExistingServer: true,
    timeout: 120000,
  },
  use: { baseURL: 'http://127.0.0.1:4174' },
});
