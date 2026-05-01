/**
 * Common e2e environment helpers shared across ExBrain test suites.
 *
 * Source of truth for local dev: **onebox/.env** (sibling of each test repo).
 * In CI: env vars are injected directly; this function is a no-op.
 *
 * Each suite uses its own dedicated env var for the base URL:
 *   HELLO_E2E_BASE_URL   — hello-e2e
 *   EXBRAIN_E2E_BASE_URL — exbrain-e2e
 *
 * Usage in playwright.config.ts:
 *   loadE2eDotenv();
 *   const baseURL = getBaseUrl('HELLO_E2E_BASE_URL', 'https://exbrain.onebox/hello');
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

/**
 * Loads onebox/.env into process.env for local dev. No-op in CI.
 * Does NOT patch or override any URL variables — each suite reads its own.
 */
export function loadE2eDotenv(): void {
  if (process.env.CI) {
    return;
  }

  const oneboxEnv = path.join(process.cwd(), '..', 'onebox', '.env');
  if (fs.existsSync(oneboxEnv)) {
    dotenv.config({ path: oneboxEnv, override: true });
  }

  // Suite-local generated env file (e.g. exbrain-e2e/.e2e-brainsec-ids.env from
  // scripts/seed-brain-security-test-data.sh). Without this, running
  // `playwright test` directly — instead of the npm script that sources the file
  // first — leaves E2E_BRAINSEC_*_BRAIN_ID unset and 99-brain-security-bootstrap
  // fails with "missing env vars from seed script".
  const brainsecEnv = path.join(process.cwd(), '.e2e-brainsec-ids.env');
  if (fs.existsSync(brainsecEnv)) {
    dotenv.config({ path: brainsecEnv, override: true });
  }
}

/**
 * Returns the base URL for the app under test.
 *
 * @param envVar   The suite-specific env var (e.g. 'HELLO_E2E_BASE_URL').
 * @param fallback Default when the env var is not set.
 *
 * Example:
 *   getBaseUrl('HELLO_E2E_BASE_URL', 'https://exbrain.onebox/hello')
 *   getBaseUrl('EXBRAIN_E2E_BASE_URL', 'https://exbrain.onebox/exbrain')
 */
export function getBaseUrl(envVar: string, fallback: string): string {
  return ((process.env[envVar] ?? '') || fallback).replace(/\/$/, '');
}

/**
 * Returns true when HTTPS errors should be ignored (e.g. self-signed certs on onebox).
 */
export function getIgnoreHttpErrors(baseUrl: string): boolean {
  return (
    !!process.env.E2E_IGNORE_HTTPS_ERRORS ||
    baseUrl.includes('onebox') ||
    baseUrl.includes('localhost') ||
    baseUrl.includes('127.0.0.1')
  );
}
