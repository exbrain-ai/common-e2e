import * as fs from 'fs';
import * as path from 'path';

export interface TestUser {
  email: string;
  password: string;
}

/** CSV format: first line header (test_email,test_password), then one row per user. */
function parseUsersCsvContent(content: string): TestUser[] {
  const lines = content.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  if (!header.includes('test_email') || !header.includes('test_password')) return [];
  const users: TestUser[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((s: string) => s.trim());
    const email = parts[0];
    const password = parts[1];
    if (email && password) users.push({ email, password });
  }
  return users;
}

/**
 * Load test users from env. Sources (in order):
 * 1. E2E_AUTH_EMAIL + E2E_AUTH_PASSWORD (single user; backward compat and CI override).
 * 2. E2E_USERS_CSV: if value contains newline or literal \n, treated as inline CSV content;
 *    otherwise treated as path to CSV file (e.g. ../onebox/e2e-test-users.csv when running from hello-e2e).
 * On GitHub: secret E2E_USERS_CSV is set from onebox/.env when running Terraform (run-with-onebox-env.sh). Local/onebox: set E2E_USERS_CSV in onebox/.env (inline CSV, rows separated by \n); that file is the single source of credentials.
 */
function loadTestUsersFromEnv(): TestUser[] {
  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;
  if (email && password) return [{ email, password }];

  const csvRaw = process.env.E2E_USERS_CSV;
  if (!csvRaw) return [];

  // Inline CSV: value contains newline or escaped \n (from .env single-line)
  const hasNewline = csvRaw.includes('\n') || csvRaw.includes('\\n');
  if (hasNewline) {
    const content = csvRaw.replace(/\\n/g, '\n');
    return parseUsersCsvContent(content);
  }

  // File path (e.g. ../onebox/e2e-test-users.csv when cwd is hello-e2e)
  const resolved = path.isAbsolute(csvRaw) ? csvRaw : path.resolve(process.cwd(), csvRaw);
  if (!fs.existsSync(resolved)) return [];
  const content = fs.readFileSync(resolved, 'utf-8');
  return parseUsersCsvContent(content);
}

let _cachedUsers: TestUser[] | null = null;

function getCachedUsers(): TestUser[] {
  if (_cachedUsers === null) _cachedUsers = loadTestUsersFromEnv();
  return _cachedUsers;
}

/**
 * First test user (backward compat). Prefer E2E_AUTH_EMAIL/PASSWORD, else first row from E2E_USERS_CSV.
 */
export function getTestUser(): TestUser | null {
  const users = getCachedUsers();
  return users.length > 0 ? users[0]! : null;
}

/**
 * All test users (up to 10 from onebox/e2e-test-users.csv or GitHub secret E2E_USERS_CSV).
 */
export function getTestUsers(): TestUser[] {
  return [...getCachedUsers()];
}
