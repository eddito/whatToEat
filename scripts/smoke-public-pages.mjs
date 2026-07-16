const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://127.0.0.1:3000";

const checks = [
  { path: "/", includes: ["今天吃什么", "探店榜单"] },
  { path: "/lists/red-list", includes: ["红榜", "当前显示"] },
  { path: "/lists/retry-list", includes: ["再练练", "当前显示"] },
  { path: "/places/red-list-15", includes: ["评分", "地图"] },
  { path: "/map", includes: ["地图探索"] },
  { path: "/login", includes: ["登录后参与评分和管理"] },
];

function buildUrl(path) {
  return new URL(path, appUrl).toString();
}

async function fetchText(path) {
  const response = await fetch(buildUrl(path), {
    signal: AbortSignal.timeout(8000),
  });
  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    text,
  };
}

const results = [];

for (const check of checks) {
  try {
    const result = await fetchText(check.path);
    const missing = check.includes.filter((fragment) => !result.text.includes(fragment));

    results.push({
      path: check.path,
      ok: result.ok && missing.length === 0,
      status: result.status,
      missing,
    });
  } catch (error) {
    results.push({
      path: check.path,
      ok: false,
      status: "error",
      missing: [error instanceof Error ? error.message : String(error)],
    });
  }
}

for (const result of results) {
  const label = result.ok ? "PASS" : "FAIL";
  const detail = result.missing.length ? ` missing=${JSON.stringify(result.missing)}` : "";
  console.log(`${label} ${result.path} status=${result.status}${detail}`);
}

if (results.some((result) => !result.ok)) {
  process.exit(1);
}
