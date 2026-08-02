import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const USERNAME_EMAIL_DOMAIN = "users.what-to-eat-today.invalid";
const root = process.cwd();

function loadEnvFile() {
  const envPath = resolve(root, ".env.local");

  if (!existsSync(envPath)) {
    return false;
  }

  const envText = readFileSync(envPath, "utf8");

  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=(.*)$/);

    if (!match || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }

  return true;
}

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getLoginCredentials(account, password) {
  const loginAccount = account.trim();

  if (loginAccount.includes("@")) {
    return { email: loginAccount, password };
  }

  if (/^\+?\d{6,15}$/.test(loginAccount)) {
    return { phone: loginAccount, password };
  }

  return { email: `${loginAccount}@${USERNAME_EMAIL_DOMAIN}`, password };
}

function buildUrl(path) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://127.0.0.1:3000";

  return new URL(path, appUrl).toString();
}

async function safeFetch(...args) {
  try {
    return await fetch(...args);
  } catch (error) {
    const code = error?.cause?.code;
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(code ? `${message} (${code})` : message);
  }
}

async function fetchJson(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      accept: "application/json",
    },
    signal: AbortSignal.timeout(12000),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  return { response, json };
}

function assertCheck(label, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` ${detail}` : ""}`);

  if (!ok) {
    process.exitCode = 1;
  }
}

async function withMutedFetchErrorLog(callback) {
  const originalError = console.error;

  console.error = (...args) => {
    const firstArg = args[0];
    const message = firstArg instanceof Error ? firstArg.message : String(firstArg);

    if (message.includes("fetch failed")) {
      return;
    }

    originalError(...args);
  };

  try {
    return await callback();
  } finally {
    console.error = originalError;
  }
}

async function main() {
  loadEnvFile();

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const username = requireEnv("SMOKE_AUTH_USERNAME");
  const password = requireEnv("SMOKE_AUTH_PASSWORD");
  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
    },
    global: {
      fetch: safeFetch,
    },
  });

  const { data: authData, error: authError } = await withMutedFetchErrorLog(() =>
    supabase.auth.signInWithPassword(getLoginCredentials(username, password)),
  );

  if (authError || !authData.session?.access_token) {
    throw new Error(`auth login: ${authError?.message ?? "missing access token"}`);
  }

  const token = authData.session.access_token;
  const authHeaders = { authorization: `Bearer ${token}` };

  const summary = await fetchJson("/api/admin/summary", {
    headers: authHeaders,
  });
  assertCheck("admin summary status", summary.response.status === 200, `status=${summary.response.status}`);
  assertCheck(
    "admin summary current user",
    Boolean(summary.json?.currentUser?.role),
    `role=${summary.json?.currentUser?.role ?? "missing"}`,
  );

  const places = await fetchJson("/api/admin/places", {
    headers: authHeaders,
  });
  assertCheck("admin places status", places.response.status === 200, `status=${places.response.status}`);
  assertCheck(
    "admin places data",
    Array.isArray(places.json?.places) && places.json.places.length > 0,
    `count=${places.json?.places?.length ?? 0}`,
  );

  const samplePlaceId = places.json?.places?.[0]?.id;

if (samplePlaceId) {
  const rating = await fetchJson(`/api/ratings?placeId=${encodeURIComponent(samplePlaceId)}`, {
    headers: authHeaders,
  });
  assertCheck("rating lookup status", rating.response.status === 200, `status=${rating.response.status}`);
    assertCheck(
      "rating lookup source",
      ["team_member", "external"].includes(rating.json?.source),
      `source=${rating.json?.source ?? "missing"}`,
  );

  const placeLists = await fetchJson(`/api/admin/place-lists?placeId=${encodeURIComponent(samplePlaceId)}`, {
    headers: authHeaders,
  });
  assertCheck("place list assignments status", placeLists.response.status === 200, `status=${placeLists.response.status}`);
  assertCheck(
    "place list assignments data",
    Array.isArray(placeLists.json?.lists) && placeLists.json.lists.length > 0,
    `count=${placeLists.json?.lists?.length ?? 0}`,
  );

  const placeListsPatch = await fetchJson("/api/admin/place-lists", {
    method: "PATCH",
    headers: {
      ...authHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      placeId: samplePlaceId,
      lists: (placeLists.json?.lists ?? []).map((list) => ({
        listId: list.id,
        included: list.included,
        sortOrder: list.sortOrder,
      })),
    }),
  });
  assertCheck("place list assignments save", placeListsPatch.response.status === 200, `status=${placeListsPatch.response.status}`);
}

const ratingHistory = await fetchJson("/api/ratings/me", {
  headers: authHeaders,
});
assertCheck("rating history status", ratingHistory.response.status === 200, `status=${ratingHistory.response.status}`);
assertCheck("rating history data", Array.isArray(ratingHistory.json?.ratings), `count=${ratingHistory.json?.ratings?.length ?? 0}`);

const photoUploadValidation = await fetchJson("/api/admin/photos", {
  method: "POST",
  headers: authHeaders,
});
assertCheck("photo upload validation", photoUploadValidation.response.status === 400, `status=${photoUploadValidation.response.status}`);

const members = await fetchJson("/api/admin/members", {
  headers: authHeaders,
});
assertCheck("admin members status", members.response.status === 200, `status=${members.response.status}`);
assertCheck("admin members data", Array.isArray(members.json?.members), `count=${members.json?.members?.length ?? 0}`);

const passwordResetForbidden = await fetchJson("/api/admin/members/password", {
  method: "PATCH",
  headers: {
    ...authHeaders,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    account: "testuser@users.what-to-eat-today.invalid",
    password: "NoChange_2026",
  }),
});
assertCheck("member cannot reset passwords", passwordResetForbidden.response.status === 403, `status=${passwordResetForbidden.response.status}`);

const lists = await fetchJson("/api/admin/lists", {
  headers: authHeaders,
});
  assertCheck("admin lists status", lists.response.status === 200, `status=${lists.response.status}`);
  assertCheck(
    "admin lists data",
    Array.isArray(lists.json?.lists) && lists.json.lists.length > 0,
    `count=${lists.json?.lists?.length ?? 0}`,
  );

  if (lists.json?.canManage === false && lists.json?.lists?.[0]) {
    const firstList = lists.json.lists[0];
    const forbiddenPatch = await fetchJson("/api/admin/lists", {
      method: "PATCH",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        listId: firstList.id,
        name: firstList.name,
        description: firstList.description,
        visibility: firstList.visibility,
      }),
    });

    assertCheck("member cannot manage lists", forbiddenPatch.response.status === 403, `status=${forbiddenPatch.response.status}`);

    const forbiddenCreate = await fetchJson("/api/admin/lists", {
      method: "POST",
      headers: {
        ...authHeaders,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        slug: "member-smoke-list",
        name: "Member Smoke List",
        visibility: "private",
      }),
    });
    assertCheck("member cannot create lists", forbiddenCreate.response.status === 403, `status=${forbiddenCreate.response.status}`);
  }

  await withMutedFetchErrorLog(() => supabase.auth.signOut());

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
}

main().catch((error) => {
  console.error(`FAIL smoke:auth ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
