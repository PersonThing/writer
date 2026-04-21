export default {
  testDir: './tests',
  fullyParallel: false, // shared DB state — serialize tests
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3456',
  },
  webServer: {
    command:
      'npx vite build && node --env-file-if-exists=.env.local scripts/migrate.js && node --env-file-if-exists=.env.local server/index.js',
    url: 'http://localhost:3456/auth/me',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { NODE_ENV: 'test' },
  },
}
