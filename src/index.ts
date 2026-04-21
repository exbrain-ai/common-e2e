// Auth
export type { LoginCredentials } from './auth/login.js';
export { loginAsTestUser, completeLoginOnCurrentPage } from './auth/login.js';

// Fixtures
export type { TestUser } from './fixtures/users.js';
export { getTestUser, getTestUsers } from './fixtures/users.js';

// Env
export { loadE2eDotenv, getBaseUrl, getIgnoreHttpErrors } from './env/index.js';

// Helpers
export { waitForLoadingToSettle } from './helpers/loading.js';
export { getAppAlert } from './helpers/alerts.js';
export {
  submitHelloGreetingViaForm,
  type SubmitHelloGreetingViaFormOptions,
} from './helpers/hello-greeting-form.js';
// Verbose logger (gated on E2E_VERBOSE=1)
export { createVerboseLogger } from './helpers/verbose-logger.js';
