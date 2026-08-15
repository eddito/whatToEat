const DEFAULT_BASE_URL = "http://127.0.0.1:3101";
const OWNER_USERNAME = "testowner";
const OWNER_PASSWORD = "TestOwner_2026";
const MEMBER_USERNAME = "testuser";
const MEMBER_PASSWORD = "TestUser_2026";
const EXTERNAL_USERNAME = "testexternal";
const EXTERNAL_PASSWORD = "TestExternal_2026";

function getBaseUrl() {
  return (process.env.BACKEND_SMOKE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
}

async function readJson(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await readJson(response);

  return {
    status: response.status,
    body,
  };
}

function assert(condition, message, details) {
  if (!condition) {
    const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : "";
    throw new Error(`${message}${suffix}`);
  }
}

function authHeaders(token) {
  return {
    authorization: `Bearer ${token}`,
  };
}

async function login(username, password) {
  const result = await requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  assert(result.status === 200, `${username} login should return 200`, result);
  assert(Boolean(result.body?.session?.accessToken), `${username} login should include access token`, result);

  return {
    accessToken: result.body.session.accessToken,
    refreshToken: result.body.session.refreshToken,
  };
}

async function expectStatus(label, path, token, status) {
  const result = await requestJson(path, {
    headers: token ? authHeaders(token) : undefined,
  });

  assert(result.status === status, `${label} should return ${status}`, result);

  return result;
}

async function main() {
  const owner = await login(OWNER_USERNAME, OWNER_PASSWORD);
  const member = await login(MEMBER_USERNAME, MEMBER_PASSWORD);
  const external = await login(EXTERNAL_USERNAME, EXTERNAL_PASSWORD);

  const ownerMe = await expectStatus("owner /api/auth/me", "/api/auth/me", owner.accessToken, 200);
  assert(ownerMe.body?.session?.user?.username === OWNER_USERNAME, "Owner /api/auth/me should include username", ownerMe);
  assert(
    ownerMe.body?.session?.memberships?.some((membership) => membership.role === "owner"),
    "Owner /api/auth/me should include owner membership",
    ownerMe,
  );

  const refresh = await requestJson("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: owner.refreshToken }),
  });
  assert(refresh.status === 200, "Refresh should return 200", refresh);
  assert(Boolean(refresh.body?.session?.accessToken), "Refresh should include access token", refresh);

  const lists = await expectStatus("owner admin lists", "/api/admin/lists", owner.accessToken, 200);
  assert(lists.body?.lists?.some((list) => list.slug === "red-list"), "Admin lists should include red-list", lists);

  const ownerSummary = await expectStatus("owner admin summary", "/api/admin/summary", owner.accessToken, 200);
  assert(ownerSummary.body?.summary?.team?.role === "owner", "Admin summary should include owner role", ownerSummary);
  assert(
    ownerSummary.body?.summary?.counts?.activePlaces > 0,
    "Admin summary should include active place count",
    ownerSummary,
  );

  const memberSummary = await expectStatus("member admin summary", "/api/admin/summary", member.accessToken, 200);
  assert(memberSummary.body?.summary?.team?.role === "member", "Admin summary should include member role", memberSummary);

  const listPlaces = await expectStatus(
    "member admin list places",
    "/api/admin/lists/red-list/places",
    member.accessToken,
    200,
  );
  assert((listPlaces.body?.places?.length ?? 0) > 0, "Admin list places should include places", listPlaces);

  const firstPlaceId = listPlaces.body.places[0].id;
  const adminPlaces = await expectStatus(
    "owner admin places",
    `/api/admin/places?query=${encodeURIComponent(firstPlaceId)}&limit=5`,
    owner.accessToken,
    200,
  );
  assert(
    adminPlaces.body?.places?.some((item) => item.id === firstPlaceId),
    "Admin places should support querying by stable place id/name fields",
    adminPlaces,
  );

  const place = await expectStatus("owner admin place detail", `/api/admin/places/${firstPlaceId}`, owner.accessToken, 200);
  assert(place.body?.place?.id === firstPlaceId, "Admin place detail should return requested place", place);

  const ratings = await expectStatus(
    "owner admin place ratings",
    `/api/admin/places/${firstPlaceId}/ratings`,
    owner.accessToken,
    200,
  );
  assert(Array.isArray(ratings.body?.ratings), "Admin place ratings should return an array", ratings);

  const members = await expectStatus("owner admin members", "/api/admin/members", owner.accessToken, 200);
  assert(members.body?.members?.some((item) => item.username === OWNER_USERNAME), "Members should include owner", members);

  const importBatches = await expectStatus(
    "owner import batches",
    "/api/admin/import-batches?limit=3",
    owner.accessToken,
    200,
  );
  assert((importBatches.body?.importBatches?.length ?? 0) > 0, "Import batches should include rows", importBatches);

  const importBatchId = importBatches.body.importBatches[0].id;
  const importBatch = await expectStatus(
    "owner import batch detail",
    `/api/admin/import-batches/${encodeURIComponent(importBatchId)}?previewLimit=5`,
    owner.accessToken,
    200,
  );
  assert(importBatch.body?.importBatch?.id === importBatchId, "Import batch detail should return requested batch", importBatch);
  assert(
    Array.isArray(importBatch.body?.importBatch?.preview?.places),
    "Import batch detail should include place preview",
    importBatch,
  );

  await expectStatus("member import batches forbidden", "/api/admin/import-batches", member.accessToken, 403);
  await expectStatus(
    "member import batch detail forbidden",
    `/api/admin/import-batches/${encodeURIComponent(importBatchId)}`,
    member.accessToken,
    403,
  );
  await expectStatus("external admin summary forbidden", "/api/admin/summary", external.accessToken, 403);
  await expectStatus("external admin lists forbidden", "/api/admin/lists", external.accessToken, 403);
  await expectStatus("missing token members rejected", "/api/admin/members", null, 401);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: getBaseUrl(),
        checks: [
          "owner login and /api/auth/me",
          "refresh token",
          "admin summary",
          "admin lists",
          "admin places",
          "admin list places",
          "admin place detail",
          "admin place ratings",
          "admin members",
          "import batches",
          "import batch detail",
          "member/external/no-token permission guards",
        ],
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
