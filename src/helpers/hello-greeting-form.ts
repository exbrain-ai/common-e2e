import type { Page } from '@playwright/test';

/**
 * Options for {@link submitHelloGreetingViaForm}.
 * Use `waitForListRefetch: false` for bulk seeding when callers only need POST success.
 */
export type SubmitHelloGreetingViaFormOptions = {
  waitForListRefetch?: boolean;
  /**
   * Substring matched against request/response URLs (default `/api/greetings`).
   * Override if a future app proxies the same Hello OpenAPI shape under a different path prefix.
   */
  apiPathIncludes?: string;
  /** Delay between key presses for `pressSequentially` (default 25). */
  keyPressDelayMs?: number;
};

const defaultOptions: Required<Pick<SubmitHelloGreetingViaFormOptions, 'apiPathIncludes' | 'keyPressDelayMs'>> & {
  waitForListRefetch: boolean;
} = {
  waitForListRefetch: true,
  apiPathIncludes: '/api/greetings',
  keyPressDelayMs: 25,
};

function resolveOptions(options?: SubmitHelloGreetingViaFormOptions) {
  return {
    waitForListRefetch: options?.waitForListRefetch ?? defaultOptions.waitForListRefetch,
    apiPathIncludes: options?.apiPathIncludes ?? defaultOptions.apiPathIncludes,
    keyPressDelayMs: options?.keyPressDelayMs ?? defaultOptions.keyPressDelayMs,
  };
}

/**
 * Submit the Hello app greeting form (ConditionalGreetingForm): visibility radios,
 * optional message, Submit — then assert POST JSON and optionally wait for list refetch.
 *
 * Uses `pressSequentially` + POST body assertion so tests do not depend on RHF syncing
 * the DOM value before submit (avoids flaky `toHaveValue` in headed/slow runs).
 *
 * **Empty message**: when `message` is empty or whitespace, skips typing and does not
 * assert `message` in the POST body (only POST 200/201 + optional list GET).
 *
 * Intended for **hello-e2e** and any other suite (e.g. exbrain-e2e) that drives the same UI.
 */
export async function submitHelloGreetingViaForm(
  page: Page,
  visibility: 'public' | 'private',
  message: string,
  options?: SubmitHelloGreetingViaFormOptions
): Promise<void> {
  const { waitForListRefetch, apiPathIncludes, keyPressDelayMs } = resolveOptions(options);
  const assertBodyMessage = message.trim().length > 0;

  if (visibility === 'private') {
    await page.getByLabel(/^Private$/i).click();
  } else {
    await page.getByLabel(/^Public$/i).click();
  }

  // `#message` is stable across locales; placeholder text is translated (i18n e2e runs before greeting-flow).
  const messageInput = page.locator('#message');
  // Use `waitFor`, not `expect` from `@playwright/test`: this module is re-exported from
  // `common-e2e/index.ts`, which `hello-e2e/playwright.config.ts` loads via load-e2e-dotenv.
  // Importing `expect` here would load the Playwright test runner twice and crash config load.
  await messageInput.waitFor({ state: 'visible', timeout: 10000 });
  await messageInput.click();
  await messageInput.clear();

  const postRequestPromise = page.waitForRequest(
    (r) => r.url().includes(apiPathIncludes) && r.method() === 'POST',
    { timeout: 20000 }
  );
  const postDone = page.waitForResponse(
    (res) =>
      res.url().includes(apiPathIncludes) &&
      res.request().method() === 'POST' &&
      (res.status() === 200 || res.status() === 201),
    { timeout: 15000 }
  );
  const listRefetched = waitForListRefetch
    ? page.waitForResponse(
        (res) =>
          res.url().includes(apiPathIncludes) &&
          res.request().method() === 'GET' &&
          res.status() === 200,
        { timeout: 15000 }
      )
    : null;

  if (assertBodyMessage) {
    await messageInput.pressSequentially(message, { delay: keyPressDelayMs });
    await page.waitForFunction(
      ({ id, want }) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        return el?.value === want;
      },
      { id: 'message', want: message },
      { timeout: 15000 }
    );
  }

  await page.getByRole('button', { name: /^submit$/i }).click();

  const postReq = await postRequestPromise;
  if (assertBodyMessage) {
    let posted: { message?: string };
    try {
      posted = JSON.parse(postReq.postData() || '{}') as { message?: string };
    } catch {
      throw new Error('POST greeting body was not valid JSON');
    }
    if (posted.message !== message) {
      throw new Error(
        `Expected POST to include message text; got ${JSON.stringify(posted)}.`,
      );
    }
  }

  await postDone;
  if (listRefetched) {
    await listRefetched;
  }
}
