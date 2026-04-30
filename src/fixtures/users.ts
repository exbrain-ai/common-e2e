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

function readUsersFromCsvPath(resolved: string): TestUser[] {
  if (!fs.existsSync(resolved)) return [];
  const content = fs.readFileSync(resolved, 'utf-8');
  return parseUsersCsvContent(content);
}

/**
 * Load test users from env. Sources (in order):
 * 1. E2E_AUTH_EMAIL + E2E_AUTH_PASSWORD (single user).
 * 2. E2E_USERS_CSV: newline or \\n → inline CSV; else path (cwd-relative or absolute).
 * 3. E2E_USERS_CSV_FILE: explicit CSV path.
 * 4. E2E_CREDENTIALS_ENV: deploy environment key (e.g. test, ppe) → common-e2e/testusers/<env>.csv
 *    (not used for prod — prod CSV is never written to that path; use E2E_USERS_CSV from CI org secret or paste from KV).
 *
 * Cloud CI: workflows set E2E_USERS_CSV from org secrets TEST_USERS_CSV_*.
 */
function loadTestUsersFromEnv(): TestUser[] {
  const email = process.env.E2E_AUTH_EMAIL;
  const password = process.env.E2E_AUTH_PASSWORD;
  if (email && password) return [{ email, password }];

  const csvRaw = process.env.E2E_USERS_CSV;
  if (csvRaw) {
    const hasNewline = csvRaw.includes('\n') || csvRaw.includes('\\n');
    if (hasNewline) {
      const content = csvRaw.replace(/\\n/g, '\n');
      return parseUsersCsvContent(content);
    }
    const resolved = path.isAbsolute(csvRaw) ? csvRaw : path.resolve(process.cwd(), csvRaw);
    return readUsersFromCsvPath(resolved);
  }

  const csvFile = process.env.E2E_USERS_CSV_FILE?.trim();
  if (csvFile) {
    const resolved = path.isAbsolute(csvFile) ? csvFile : path.resolve(process.cwd(), csvFile);
    return readUsersFromCsvPath(resolved);
  }

  const credEnv = process.env.E2E_CREDENTIALS_ENV?.trim();
  if (credEnv) {
    const cwd = process.cwd();
    const p = path.resolve(cwd, '..', 'common-e2e', 'testusers', `${credEnv}.csv`);
    const users = readUsersFromCsvPath(p);
    if (users.length > 0) return users;
  }

  return [];
}

let _cachedUsers: TestUser[] | null = null;

function getCachedUsers(): TestUser[] {
  if (_cachedUsers === null) _cachedUsers = loadTestUsersFromEnv();
  return _cachedUsers;
}

export function getTestUser(): TestUser | null {
  const users = getCachedUsers();
  return users.length > 0 ? users[0]! : null;
}

export function getTestUsers(): TestUser[] {
  return [...getCachedUsers()];
}
