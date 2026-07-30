import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 5 * 60 * 1000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'bun run dev -- --host 127.0.0.1',
    env: {
      VITE_SYNC_HOST:
        process.env.PLAYWRIGHT_SYNC_HOST ?? 'test-kniffel.schreiber-lang.de',
    },
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'webkit-iphone',
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
      },
    },
    {
      name: 'webkit-desktop',
      use: {
        ...devices['Desktop Safari'],
        browserName: 'webkit',
      },
    },
    ...(process.env.PLAYWRIGHT_INCLUDE_GTK === '1'
      ? [
          {
            name: 'webkit-gtk-iphone',
            use: {
              ...devices['iPhone 13'],
              browserName: 'webkit' as const,
              headless: false,
            },
          },
        ]
      : []),
  ],
});
