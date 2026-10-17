import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./frontend/tests/browser', workers:1, fullyParallel:false,
  outputDir:'.runtime/browser-results',
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', {open:'never'}]] : 'list',
  use:{browserName:'chromium',channel:process.env.CI ? undefined : 'msedge',viewport:{width:1366,height:900},headless:true,trace:'retain-on-failure',screenshot:'only-on-failure'},
});
