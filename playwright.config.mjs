import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./frontend/tests/browser', workers:1, fullyParallel:false,
  outputDir:'.runtime/browser-results',
  use:{browserName:'chromium',channel:'msedge',viewport:{width:1366,height:900},headless:true},
});
