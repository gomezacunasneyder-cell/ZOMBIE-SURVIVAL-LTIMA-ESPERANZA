import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  // Las pruebas de jugabilidad dependen del tiempo real: pocos navegadores a la vez.
  fullyParallel: false,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    // Usa el Edge del sistema para no descargar un navegador aparte.
    // En otro sistema: ZS_CHANNEL=chrome, o instalar con `npx playwright install chromium`.
    channel: process.env.ZS_CHANNEL ?? 'msedge',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
