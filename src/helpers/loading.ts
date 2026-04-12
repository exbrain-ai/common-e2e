import type { Locator } from '@playwright/test';

/**
 * Waits for a loading indicator to appear (briefly) then disappear.
 *
 * The `visibleTimeout` is intentionally short — if the loading indicator
 * doesn't appear quickly it may have already resolved. The catch suppresses
 * that case. The `hiddenTimeout` is longer to allow for slow responses.
 *
 * Usage:
 *   const spinner = page.getByText('Loading...');
 *   await waitForLoadingToSettle(spinner);
 */
export async function waitForLoadingToSettle(
  locator: Locator,
  {
    visibleTimeout = 3000,
    hiddenTimeout = 15000,
  }: { visibleTimeout?: number; hiddenTimeout?: number } = {}
): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout: visibleTimeout }).catch(() => {});
  await locator.waitFor({ state: 'hidden', timeout: hiddenTimeout });
}
