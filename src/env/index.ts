/**
 * Common e2e environment helpers shared across ExBrain test suites.
 *
 * Source of truth for local dev: **onebox/.env** (sibling directory).
 * In CI: env vars are injected directly; no .env file is read.
 *
 * Usage in playwright.config.ts:
 *   import { loadE2eDotenv } from '@exbrain/common-e2e';
 *   loadE2eDotenv({ appUrlEnvVar: 'HELLO_E2E_BASE_URL' }); // hello-e2e
 *   loadE2eDotenv();                                         // exbrain-e2e
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

export interface LoadE2eDotenvOptions {
  /**
   * If set and this env var has a non-empty value, its value overrides E2E_BASE_URL.
   * Allows hello-e2e and exbrain-e2e to coexist in the same onebox/.env file
   * using separate URL variables (e.g. 'HELLO_E2E_BASE_URL', 'EXBRAIN_E2E_BASE_URL').
   */
  appUrlEnvVar?: string;
}

export function loadE2eDotenv(opts?: LoadE2eDotenvOptions): void {
  if (process.env.CI) {
    return; // CI injects vars directly — no .env file expected.
  }

  const oneboxEnv = path.join(process.cwd(), '..', 'onebox', '.env');
  if (fs.existsSync(oneboxEnv)) {
    dotenv.config({ path: oneboxEnv, override: true });
  }

  // Apply app-specific URL override after loading .env
  if (opts?.appUrlEnvVar) {
    const appUrl = (process.env[opts.appUrlEnvVar] ?? '').trim();
    if (appUrl) {
      process.env.E2E_BASE_URL = appUrl;
    }
  }
}

/**
 * Returns the base URL for the app under test.
 * Reads E2E_BASE_URL (set by loadE2eDotenv) with a fallback default.
 */
export function getBaseUrl(defaultUrl = 'https://exbrain.onebox'): string {
  return (process.env.E2E_BASE_URL ?? defaultUrl).replace(/\/$/, '');
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
