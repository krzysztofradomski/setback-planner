import { defineConfig } from '@playwright/test';
const preview=process.env.PLAYWRIGHT_PREVIEW==='1';
export default defineConfig({
  testDir:'./tests/browser',
  use:{baseURL:'http://127.0.0.1:5173',locale:'en-US'},
  webServer:{command:preview?'npm run preview':'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI&&!preview},
  workers:1,
});
