const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list']],
  timeout: 60000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
    // the sandbox ships Chromium build 1194; use it rather than downloading
    launchOptions: { executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] },
  },
});
