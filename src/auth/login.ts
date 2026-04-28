import type { Page } from '@playwright/test';

export interface LoginCredentials {
  email: string;
  password: string;
}

/** Accessible names for the primary submit on Hello / Auth0 login (single source of truth). */
const AUTH_PRIMARY_BUTTON =
  /sign in|log in|continue|submit/i;

/**
 * Identifier-first step 1: Auth0 often shows "Continue" / "Next" before the password screen.
 * Narrower than AUTH_PRIMARY_BUTTON so we prefer advancing to the password step when both exist.
 */
const AUTH_CONTINUE_BUTTON = /continue|next|submit/i;

/** Match Auth0 UL and common custom fields (ids may be on non-input in older templates). */
const AUTH_EMAIL =
  'input[name="username"], input[name="email"], #username, #email';
const AUTH_PASSWORD = 'input[name="password"], #password';

async function clickPrimaryAuthButton(page: Page): Promise<void> {
  await page.getByRole('button', { name: AUTH_PRIMARY_BUTTON }).first().click();
}

/**
 * After filling email on identifier-first: prefer Continue/Next, else primary (e.g. one-step).
 */
async function clickContinueOrPrimaryAuth(page: Page): Promise<void> {
  const continueBtn = page.getByRole('button', { name: AUTH_CONTINUE_BUTTON }).first();
  if (await continueBtn.isVisible()) {
    await continueBtn.click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
  } else {
    await clickPrimaryAuthButton(page);
  }
}

/**
 * True when both email and password fields are visible (one-screen login: in-app or Auth0).
 */
async function isSinglePageLogin(page: Page): Promise<boolean> {
  const email = page.getByLabel(/email/i).first();
  const password = page.getByLabel(/password/i).first();
  await email.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  const emailVisible = await email.isVisible();
  const passwordVisible = await password.isVisible();
  return emailVisible && passwordVisible;
}

async function loginSinglePage(page: Page, creds: LoginCredentials): Promise<void> {
  await page.getByLabel(/email/i).first().fill(creds.email);
  await page.getByLabel(/password/i).first().fill(creds.password);
  await clickPrimaryAuthButton(page);
}

/**
 * Auth0 identifier-first: email screen → password screen → submit.
 */
async function loginAuth0IdentifierFirst(page: Page, creds: LoginCredentials): Promise<void> {
  const emailInput = page.locator(AUTH_EMAIL).first();
  await emailInput.waitFor({ state: 'visible', timeout: 8000 });
  await emailInput.fill(creds.email);
  await clickContinueOrPrimaryAuth(page);

  const passwordInput = page.locator(AUTH_PASSWORD).first();
  await passwordInput.waitFor({ state: 'visible', timeout: 8000 });
  await passwordInput.fill(creds.password);
  await clickPrimaryAuthButton(page);
}

const DEFAULT_SUCCESS_URL = /\/hello\/?(\?.*)?$/;

/**
 * Submit credentials on the current page (in-app login or Auth0). Use after navigating to
 * `/login` or when a protected route redirected to IAM with `return_url` (e.g. onboarding).
 *
 * @param successUrl - Regex for post-login URL; defaults to `/hello`. Pass a narrow pattern
 *   (e.g. `/\/exbrain(\/|\?|$)/`) from other apps.
 */
export async function completeLoginOnCurrentPage(
  page: Page,
  creds: LoginCredentials,
  options?: {
    timeout?: number;
    successUrl?: RegExp;
    /** Passed to `waitForURL` (default `domcontentloaded`). `load` often never settles on Auth0/Next due to long-lived requests. */
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  },
): Promise<void> {
  const timeout = options?.timeout ?? 10000;
  const waitUntil = options?.waitUntil ?? 'domcontentloaded';
  const successUrl = options?.successUrl ?? DEFAULT_SUCCESS_URL;

  // Intentionally NOT awaiting 'networkidle' — Auth0 keeps background requests (analytics, device
  // fingerprinting) open for many seconds. Readiness is signalled by the email input being visible,
  // which `isSinglePageLogin` / `loginAuth0IdentifierFirst` already check for explicitly.
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  // Cached-session short-circuit. When the caller loaded a saved storage state and hits `/login`,
  // the server immediately redirects to the app. Without this guard, we'd still try to find the
  // Auth0 email field and waste ~15s per user waiting for an element that will never appear
  // (the default `waitFor` timeout in `loginAuth0IdentifierFirst`). Matters a lot in global-setup
  // loops that log in every scenario user sequentially.
  if (successUrl.test(page.url())) {
    return;
  }

  const singlePage = await isSinglePageLogin(page);
  if (singlePage) {
    await loginSinglePage(page, creds);
  } else {
    await loginAuth0IdentifierFirst(page, creds);
  }

  await page.waitForURL(successUrl, { timeout, waitUntil });
}

/**
 * Logs in the test user via the app. Supports:
 * - Single-page login (email + password visible together)
 * - Auth0 identifier-first (email then password)
 *
 * @param page - Playwright page
 * @param baseUrl - App base URL (e.g. https://exbrain.onebox/hello), no trailing slash
 * @param creds - Email and password
 * @param options.timeout - Max ms to wait for redirect after submit (default 10000)
 * @param options.successUrl - Regex to match post-login URL; defaults to `/hello`. Override per app
 *   (e.g. exbrain passes `/\/exbrain(\/|\?|$)/`).
 */
export async function loginAsTestUser(
  page: Page,
  baseUrl: string,
  creds: LoginCredentials,
  options?: {
    timeout?: number;
    successUrl?: RegExp;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  },
): Promise<void> {
  const timeout = options?.timeout ?? 10000;
  const navigationTimeout = 30000;
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: navigationTimeout });

  await completeLoginOnCurrentPage(page, creds, {
    timeout,
    successUrl: options?.successUrl,
    waitUntil: options?.waitUntil,
  });
}
