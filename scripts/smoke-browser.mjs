import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright-core";

const root = process.cwd();
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

const browserPathCandidates = [
  process.env.E2E_BROWSER_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

function loadEnvFile() {
  const envPath = resolve(root, ".env.local");

  if (!existsSync(envPath)) {
    return;
  }

  const envText = readFileSync(envPath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=(.*)$/);

    if (!match || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function findBrowserPath() {
  return browserPathCandidates.find((candidate) => candidate && existsSync(candidate));
}

function buildUrl(path) {
  return new URL(path, `${appUrl}/`).toString();
}

function assertCheck(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` ${detail}` : ""}`);

  if (!ok) {
    process.exitCode = 1;
  }
}

async function assertAppIsReachable() {
  try {
    const response = await fetch(buildUrl("/"), {
      signal: AbortSignal.timeout(5000),
    });

    assertCheck("app reachable", response.ok, `status=${response.status}`);

    if (!response.ok) {
      process.exit(1);
    }
  } catch (error) {
    console.error(
      `FAIL app reachable ${error instanceof Error ? error.message : String(error)}. Start the app with pnpm dev:safe before running smoke:browser.`,
    );
    process.exit(1);
  }
}

async function expectText(page, path, selector, expectedText) {
  await page.goto(buildUrl(path), { waitUntil: "networkidle" });
  const text = await page.locator(selector).first().innerText();
  assertCheck(`${path} ${selector}`, text.includes(expectedText), `text=${JSON.stringify(text)}`);
}

loadEnvFile();

const browserPath = findBrowserPath();

if (!browserPath) {
  console.log("SKIP smoke:browser no Chrome or Edge executable found. Set E2E_BROWSER_PATH to run this check.");
  process.exit(0);
}

await assertAppIsReachable();

const browser = await chromium.launch({
  executablePath: browserPath,
  headless: true,
});
const page = await browser.newPage({
  viewport: {
    width: 1280,
    height: 900,
  },
});
const clientErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    const text = message.text();

    if (!text.includes("Failed to load resource: the server responded with a status of 404")) {
      clientErrors.push(text);
    }
  }
});
page.on("pageerror", (error) => {
  clientErrors.push(error.stack || error.message);
});

try {
  await expectText(page, "/", "h1", "今天吃什么");
  await expectText(page, "/lists/red-list", ".list-result-line", "当前显示");
  await expectText(page, "/places/red-list-15", "h1", "80后美蛙肥肠鱼");

  const username = process.env.SMOKE_AUTH_USERNAME;
  const password = process.env.SMOKE_AUTH_PASSWORD;

  if (username && password) {
    await page.goto(buildUrl("/login?next=/admin"), { waitUntil: "networkidle" });
    await page.fill('input[name="account"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin", { timeout: 15000 });
    await page.waitForSelector("text=管理工作台", { timeout: 15000 });
    await page.waitForSelector("text=榜单排序", { timeout: 20000 });

    const orderPanels = await page.locator(".admin-list-order-box").count();
    assertCheck("/admin order panel", orderPanels > 0, `count=${orderPanels}`);

    await page.waitForSelector(".admin-list-order-row", { timeout: 20000 });
    const orderRows = page.locator(".admin-list-order-row");
    const orderRowCount = await orderRows.count();
    assertCheck("/admin order rows", orderRowCount > 1, `count=${orderRowCount}`);

    if (orderRowCount > 1) {
      const firstPlaceBeforeDrag = await orderRows.nth(0).locator(".admin-list-order-main strong").innerText();
      await orderRows.nth(0).dragTo(orderRows.nth(1));
      await page.waitForTimeout(300);
      const firstPlaceAfterDrag = await orderRows.nth(0).locator(".admin-list-order-main strong").innerText();
      assertCheck(
        "/admin order drag",
        firstPlaceAfterDrag !== firstPlaceBeforeDrag,
        `before=${JSON.stringify(firstPlaceBeforeDrag)} after=${JSON.stringify(firstPlaceAfterDrag)}`,
      );
    }

    await page.waitForSelector("text=导入运维", { timeout: 20000 });
    const importPanels = await page.locator(".admin-import-panel").count();
    assertCheck("/admin import panel", importPanels > 0, `count=${importPanels}`);
  } else {
    console.log("SKIP /admin login SMOKE_AUTH_USERNAME or SMOKE_AUTH_PASSWORD is missing.");
  }

  assertCheck("client errors", clientErrors.length === 0, clientErrors.join(" | "));
} finally {
  await browser.close();
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
