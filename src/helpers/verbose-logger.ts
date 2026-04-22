/**
 * Progress logger for e2e tests. ALWAYS appends structured lines to a log file
 * (default `test-results/e2e-progress.log` relative to cwd) so operators can
 * `tail -f` or `cat` the file when a test hangs — without ever running with
 * `--verbose`. When `E2E_VERBOSE=1` (or `=true`) is also set, the same lines
 * are echoed to stdout.
 *
 * Enable stdout echo via `ob test <suite> --verbose` or `export E2E_VERBOSE=1`.
 *
 * Override log file path with `E2E_PROGRESS_LOG` (absolute or relative to cwd).
 * Set it to an empty string or `off` to disable file logging entirely.
 *
 * @param namespace - Short tag shown as `[namespace]` in each line, e.g. "onboarding", "nav".
 * @returns a function (label, extra?) that writes `<iso> [namespace] label {JSON}`.
 *
 * @example
 *   const log = createVerboseLogger('onboarding');
 *   log('seats.reached');
 *   log('seats.pending_captured', { status: 201, bodyLen: 533 });
 */
import fs from 'node:fs';
import path from 'node:path';

function resolveLogFilePath(): string | null {
  const override = process.env.E2E_PROGRESS_LOG;
  if (override !== undefined) {
    const trimmed = override.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'off') return null;
    return path.isAbsolute(trimmed) ? trimmed : path.join(process.cwd(), trimmed);
  }
  return path.join(process.cwd(), 'test-results', 'e2e-progress.log');
}

// Resolve path once per worker; Playwright spawns workers with fresh Node processes so this
// is called per-worker and is fine. fs.mkdirSync is sync + idempotent.
let logFilePath: string | null | undefined;
function ensureLogFile(): string | null {
  if (logFilePath !== undefined) return logFilePath;
  logFilePath = resolveLogFilePath();
  if (logFilePath) {
    try {
      fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    } catch {
      // Non-fatal — disable file logging if dir creation fails
      logFilePath = null;
    }
  }
  return logFilePath;
}

export function createVerboseLogger(
  namespace: string,
): (label: string, extra?: Record<string, unknown>) => void {
  const verbose = process.env.E2E_VERBOSE === '1' || process.env.E2E_VERBOSE === 'true';
  return (label, extra) => {
    const suffix = extra ? ` ${JSON.stringify(extra)}` : '';
    const iso = new Date().toISOString();
    const line = `${iso} [${namespace}] ${label}${suffix}`;
    if (verbose) {
      // Keep stdout line without timestamp (shorter); matches the prior format.
      console.log(`[${namespace}] ${label}${suffix}`);
    }
    const file = ensureLogFile();
    if (file) {
      // Append sync — O(lines) syscalls but progress logging is low-volume and we
      // want the file to be flushed even if the process is killed mid-run.
      try {
        fs.appendFileSync(file, line + '\n');
      } catch {
        // Non-fatal; drop the write.
      }
    }
  };
}
