import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests/browser',testMatch:'showroom.spec.ts',use:{baseURL:'http://127.0.0.1:5175'},webServer:{command:'npm run dev -- --port 5175',url:'http://127.0.0.1:5175',reuseExistingServer:false},workers:1});
