// auth.setup.ts — Playwright: log in once per role, save storageState for reuse across specs.
// Copy into the target project's e2e harness (e.g. e2e/user-manual/auth.setup.ts) and adjust
// the selectors below to the target app's actual login form — this is a starting point, not
// a universal login. Credentials come from env vars, never hardcode them here.
import type { Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export type Role = { name: string; loginPath: string; storageStatePath: string };

// Env var names: role "back-office" -> BACK_OFFICE_USERNAME / BACK_OFFICE_PASSWORD.
// Source these from a gitignored .env in this e2e dir (e.g. via `dotenv/config` in
// playwright.config.ts) — never commit the file, never print the values.
export async function loginAndSaveState(page: Page, role: Role) {
  const envKey = role.name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const username = process.env[`${envKey}_USERNAME`];
  const password = process.env[`${envKey}_PASSWORD`];
  if (!username || !password) {
    throw new Error(
      `Missing ${envKey}_USERNAME / ${envKey}_PASSWORD env vars for role "${role.name}" — set them in the gitignored .env before running auth setup.`,
    );
  }

  await page.goto(role.loginPath);
  await page.getByLabel(/username|email/i).fill(username);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /log ?in|sign ?in/i }).click();
  await page.waitForURL((url) => !url.pathname.toLowerCase().includes("login"));

  await mkdir(dirname(role.storageStatePath), { recursive: true });
  await page.context().storageState({ path: role.storageStatePath });
}

// Usage in a spec/project block, once storageState exists for the role:
//   test.use({ storageState: "e2e/user-manual/.auth/<role>.json" });
// This skips the login form for every shot after the one-time auth setup run.
