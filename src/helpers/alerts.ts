/**
 * Alert helpers for Next.js apps.
 *
 * Next.js injects a hidden `role="alert" aria-live="assertive" id="__next-route-announcer__"`
 * element that is always present and empty. When tests use `getByRole('alert')`, this element
 * is also matched, causing strict mode violations or returning empty text.
 *
 * Use `getAppAlert` to target only app-level alert elements, excluding the Next.js announcer.
 */

import type { Page } from '@playwright/test';

/** The CSS selector that excludes the Next.js built-in route announcer. */
const APP_ALERT_SELECTOR = '[role="alert"]:not([id="__next-route-announcer__"])';

/**
 * Returns a Playwright Locator for app-level alert elements,
 * excluding the Next.js route announcer (`#__next-route-announcer__`).
 *
 * Use this instead of `page.getByRole('alert')` in Next.js apps to avoid
 * strict mode violations caused by the always-present (empty) route announcer.
 *
 * @example
 * await expect(getAppAlert(page)).toContainText(/error message/i, { timeout: 10000 });
 * await expect(getAppAlert(page)).not.toContainText(/sensitive detail/i);
 */
export function getAppAlert(page: Page) {
  return page.locator(APP_ALERT_SELECTOR);
}
