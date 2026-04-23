import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import type { FullConfig } from "playwright/test";

const STORAGE_STATE_PATH = "tests/setup/.auth/academic-user.json";

async function readLocalEnv(key: string): Promise<string | null> {
  if (process.env[key]) {
    return process.env[key] as string;
  }

  if (!existsSync(".env.local")) {
    return null;
  }

  const contents = await readFile(".env.local", "utf8");
  const match = contents.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) {
    return null;
  }

  const value = match[1].trim();
  if (!value) {
    return null;
  }

  return value.replace(/^['"]|['"]$/g, "");
}

async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use?.baseURL ||
    process.env.PLAYWRIGHT_BASE_URL ||
    "http://localhost:3000";
  const email = await readLocalEnv("E2E_TEST_EMAIL");
  const password = await readLocalEnv("E2E_TEST_PASSWORD");

  if (!email || !password) {
    throw new Error(
      "Missing E2E_TEST_EMAIL or E2E_TEST_PASSWORD. Add them to .env.local before running Playwright validation."
    );
  }

  await mkdir("tests/setup/.auth", { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseURL}/?auth=required&redirect=/academic`, {
    waitUntil: "domcontentloaded",
  });

  await page.waitForSelector("#email", { timeout: 10000 });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.locator('form').getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(/\/academic/, { timeout: 15000 });
  await page.context().storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}

export default globalSetup;
