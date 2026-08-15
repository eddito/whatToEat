const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const OWNER_USERNAME = "testowner";
const OWNER_PASSWORD = "TestOwner_2026";
const MEMBER_USERNAME = "testuser";
const MEMBER_PASSWORD = "TestUser_2026";
const EXTERNAL_USERNAME = "testexternal";
const EXTERNAL_PASSWORD = "TestExternal_2026";

function getBaseUrl() {
  return (process.env.BACKEND_SMOKE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
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

async function login(username, password) {
  const result = await requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  assert(result.status === 200, `${username} login should return 200`, result);
  assert(result.body?.ok === true, `${username} login should be ok`, result);
  assert(Boolean(result.body?.session?.accessToken), `${username} login should include access token`, result);

  return result.body.session.accessToken;
}

async function rate(placeId, score, token, note) {
  return requestJson("/api/ratings", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    body: JSON.stringify({ placeId, score, note }),
  });
}

async function getRating(placeId, token) {
  return requestJson(`/api/ratings?placeId=${encodeURIComponent(placeId)}`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

async function deleteRating(placeId, token) {
  return requestJson(`/api/ratings?placeId=${encodeURIComponent(placeId)}`, {
    method: "DELETE",
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

async function getAdminRatings(placeId, token) {
  return requestJson(`/api/admin/places/${encodeURIComponent(placeId)}/ratings`, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

async function deleteAdminRating(placeId, ratingId, token) {
  return requestJson(
    `/api/admin/places/${encodeURIComponent(placeId)}/ratings?ratingId=${encodeURIComponent(ratingId)}`,
    {
      method: "DELETE",
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    },
  );
}

async function main() {
  const ownerToken = await login(OWNER_USERNAME, OWNER_PASSWORD);
  const memberToken = await login(MEMBER_USERNAME, MEMBER_PASSWORD);
  const externalToken = await login(EXTERNAL_USERNAME, EXTERNAL_PASSWORD);

  const noToken = await rate("red-list-1", 4, null, "smoke no token");
  assert(noToken.status === 401, "Rating without token should return 401", noToken);

  const memberRating = await rate("red-list-1", 4.3, memberToken, "member smoke test");
  assert(memberRating.status === 200, "Member rating should return 200", memberRating);
  assert(memberRating.body?.source === "team_member", "Member rating should use team_member source", memberRating);
  assert(memberRating.body?.role === "member", "Member rating should include member role", memberRating);

  const memberRead = await getRating("red-list-1", memberToken);
  assert(memberRead.status === 200, "Member rating read should return 200", memberRead);
  assert(memberRead.body?.rating?.id === memberRating.body?.rating?.id, "Member rating read should return own rating", memberRead);

  const memberDeleted = await deleteRating("red-list-1", memberToken);
  assert(memberDeleted.status === 200, "Member rating delete should return 200", memberDeleted);
  assert(memberDeleted.body?.deleted === true, "Member rating delete should delete existing rating", memberDeleted);

  const memberReadAfterDelete = await getRating("red-list-1", memberToken);
  assert(memberReadAfterDelete.status === 200, "Member rating read after delete should return 200", memberReadAfterDelete);
  assert(memberReadAfterDelete.body?.rating === null, "Member rating should be null after delete", memberReadAfterDelete);

  const memberRestored = await rate("red-list-1", 4.3, memberToken, "member smoke test");
  assert(memberRestored.status === 200, "Member rating restore should return 200", memberRestored);

  const externalRating = await rate("red-list-1", 3.7, externalToken, "external smoke test");
  assert(externalRating.status === 200, "External public_rate rating should return 200", externalRating);
  assert(externalRating.body?.source === "external", "External rating should use external source", externalRating);
  assert(externalRating.body?.role === null, "External rating should not have team role", externalRating);

  const externalRead = await getRating("red-list-1", externalToken);
  assert(externalRead.status === 200, "External rating read should return 200", externalRead);
  assert(externalRead.body?.rating?.id === externalRating.body?.rating?.id, "External rating read should return own rating", externalRead);

  const externalAdminDelete = await deleteAdminRating("red-list-1", externalRating.body.rating.id, externalToken);
  assert(externalAdminDelete.status === 403, "External admin rating delete should return 403", externalAdminDelete);

  const ownerAdminRatings = await getAdminRatings("red-list-1", ownerToken);
  assert(ownerAdminRatings.status === 200, "Owner admin ratings should return 200", ownerAdminRatings);
  assert(
    ownerAdminRatings.body?.ratings?.some((rating) => rating.id === externalRating.body.rating.id),
    "Owner admin ratings should include external smoke rating",
    ownerAdminRatings,
  );

  const ownerAdminDelete = await deleteAdminRating("red-list-1", externalRating.body.rating.id, ownerToken);
  assert(ownerAdminDelete.status === 200, "Owner admin rating delete should return 200", ownerAdminDelete);
  assert(ownerAdminDelete.body?.deleted === true, "Owner admin rating delete should report deleted true", ownerAdminDelete);

  const externalReadAfterAdminDelete = await getRating("red-list-1", externalToken);
  assert(
    externalReadAfterAdminDelete.status === 200,
    "External rating read after admin delete should return 200",
    externalReadAfterAdminDelete,
  );
  assert(
    externalReadAfterAdminDelete.body?.rating === null,
    "External rating should be null after admin delete",
    externalReadAfterAdminDelete,
  );

  const externalRestored = await rate("red-list-1", 3.7, externalToken, "external smoke test");
  assert(externalRestored.status === 200, "External rating restore should return 200", externalRestored);

  const forbiddenExternalRating = await rate("retry-list-1", 3.2, externalToken, "external forbidden smoke test");
  assert(
    forbiddenExternalRating.status === 403,
    "External public_view-only rating should return 403",
    forbiddenExternalRating,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: getBaseUrl(),
        checks: [
          "owner login",
          "member login",
          "external login",
          "missing token rejected",
          "member team_member rating",
          "member own rating read/delete/restore",
          "external public_rate rating",
          "external own rating read",
          "external admin rating delete rejected",
          "owner admin rating read/delete",
          "external rating restore after admin delete",
          "external public_view-only rating rejected",
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
