const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const OWNER_USERNAME = "testowner";
const OWNER_PASSWORD = "TestOwner_2026";
const MEMBER_USERNAME = "testuser";
const MEMBER_PASSWORD = "TestUser_2026";
const EXTERNAL_USERNAME = "testexternal";
const EXTERNAL_PASSWORD = "TestExternal_2026";
const TARGET_MEMBER_USERNAME = "testmembertarget";
const LIST_SLUG = "red-list";
const SMOKE_LIST_SLUG = "admin-smoke-list";
const SMOKE_PLACE_ID = "red-list-1";

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

  return result.body.session.accessToken;
}

async function upsertList(token, payload) {
  return requestJson("/api/admin/lists", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

async function patchList(token, payload) {
  return requestJson("/api/admin/lists", {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

async function deleteList(token, listId) {
  return requestJson(`/api/admin/lists?listId=${encodeURIComponent(listId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

async function getAdminLists(token) {
  return requestJson("/api/admin/lists", {
    headers: authHeaders(token),
  });
}

async function getAdminPlaces(token) {
  return requestJson("/api/admin/places?limit=5", {
    headers: authHeaders(token),
  });
}

async function upsertPlace(token, payload) {
  return requestJson("/api/admin/places", {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
}

async function archivePlace(token, id, archived) {
  return requestJson("/api/admin/places/archive", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ id, archived }),
  });
}

async function getListPlaces(token, slug) {
  return requestJson(`/api/admin/lists/${encodeURIComponent(slug)}/places`, {
    headers: authHeaders(token),
  });
}

async function getAdminPlace(token, placeId) {
  return requestJson(`/api/admin/places/${encodeURIComponent(placeId)}`, {
    headers: authHeaders(token),
  });
}

async function getAdminRatings(token, placeId) {
  return requestJson(`/api/admin/places/${encodeURIComponent(placeId)}/ratings`, {
    headers: authHeaders(token),
  });
}

async function reorderListPlaces(token, slug, placeIds) {
  return requestJson(`/api/admin/lists/${encodeURIComponent(slug)}/places/order`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ placeIds }),
  });
}

async function upsertMember(token, username, role) {
  return requestJson("/api/admin/members", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ account: username, role }),
  });
}

async function removeMember(token, userId) {
  return requestJson(`/api/admin/members?userId=${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

function takeFirstPlaceIds(result) {
  return (result.body?.places ?? []).slice(0, 2).map((place) => place.id);
}

function findMember(result, username) {
  return (result.body?.members ?? []).find((member) => member.username === username) ?? null;
}

function buildPlacePayload(place, overrides = {}) {
  return {
    placeId: place.id,
    name: place.name,
    category: place.category,
    tasteTags: place.tasteTags,
    signatureDishes: place.signatureDishes,
    review: place.review,
    region: place.region,
    locationLabel: place.locationLabel,
    parkingNote: place.parkingNote,
    sourceLabel: place.sourceLabel,
    visited: place.visited,
    ...overrides,
  };
}

async function main() {
  const ownerToken = await login(OWNER_USERNAME, OWNER_PASSWORD);
  const memberToken = await login(MEMBER_USERNAME, MEMBER_PASSWORD);
  const externalToken = await login(EXTERNAL_USERNAME, EXTERNAL_PASSWORD);

  const externalListWrite = await upsertList(externalToken, {
    slug: SMOKE_LIST_SLUG,
    name: "Admin Smoke List",
    description: "Smoke test list",
    visibility: "public_view",
  });
  assert(externalListWrite.status === 403, "External list write should return 403", externalListWrite);

  let externalViewerAdded = false;
  let externalUserId = null;

  try {
    const ownerAddViewer = await upsertMember(ownerToken, EXTERNAL_USERNAME, "viewer");
    assert(ownerAddViewer.status === 200, "Owner add external viewer should return 200", ownerAddViewer);
    const externalMember = findMember(ownerAddViewer, EXTERNAL_USERNAME);
    assert(externalMember?.role === "viewer", "Owner add external viewer should set viewer role", ownerAddViewer);
    externalUserId = externalMember.userId;
    externalViewerAdded = true;

    const viewerLists = await getAdminLists(externalToken);
    assert(viewerLists.status === 200, "Viewer admin lists read should return 200", viewerLists);

    const viewerPlaces = await getAdminPlaces(externalToken);
    assert(viewerPlaces.status === 200, "Viewer admin places read should return 200", viewerPlaces);

    const viewerListPlaces = await getListPlaces(externalToken, LIST_SLUG);
    assert(viewerListPlaces.status === 200, "Viewer admin list places read should return 200", viewerListPlaces);

    const viewerPlace = await getAdminPlace(externalToken, "red-list-1");
    assert(viewerPlace.status === 200, "Viewer admin place detail read should return 200", viewerPlace);

    const viewerRatings = await getAdminRatings(externalToken, "red-list-1");
    assert(viewerRatings.status === 200, "Viewer admin place ratings read should return 200", viewerRatings);

    const viewerListWrite = await upsertList(externalToken, {
      slug: SMOKE_LIST_SLUG,
      name: "Admin Smoke List",
      description: "Viewer write should fail",
      visibility: "public_view",
    });
    assert(viewerListWrite.status === 403, "Viewer list write should return 403", viewerListWrite);
  } finally {
    if (externalViewerAdded && externalUserId) {
      await removeMember(ownerToken, externalUserId);
    }
  }

  const memberListWrite = await upsertList(memberToken, {
    slug: SMOKE_LIST_SLUG,
    name: "Admin Smoke List",
    description: "Member create should fail",
    visibility: "public_view",
  });
  assert(memberListWrite.status === 403, "Member list create should return 403", memberListWrite);

  const previousSmokeListDelete = await deleteList(ownerToken, SMOKE_LIST_SLUG);
  assert(
    previousSmokeListDelete.status === 200 || previousSmokeListDelete.status === 404,
    "Previous smoke list cleanup should return 200 or 404",
    previousSmokeListDelete,
  );

  let smokeListCreated = false;
  let originalPlace = null;
  let placeChanged = false;
  let targetMemberId = null;

  try {
    const listWrite = await upsertList(memberToken, {
      slug: SMOKE_LIST_SLUG,
      name: "Admin Smoke List",
      description: "Smoke test list",
      visibility: "public_view",
    });
    assert(listWrite.status === 403, "Member list write should return 403", listWrite);

    const ownerListWrite = await upsertList(ownerToken, {
      slug: SMOKE_LIST_SLUG,
      name: "Admin Smoke List",
      description: "Smoke test list",
      visibility: "public_view",
    });
    assert(ownerListWrite.status === 200, "Owner list create should return 200", ownerListWrite);
    assert(ownerListWrite.body?.list?.slug === SMOKE_LIST_SLUG, "Owner list create should return smoke list", ownerListWrite);
    smokeListCreated = true;

    const ownerListPatch = await patchList(ownerToken, {
      listId: SMOKE_LIST_SLUG,
      name: "Admin Smoke List",
      description: "Smoke test list updated",
      visibility: "private",
    });
    assert(ownerListPatch.status === 200, "Owner list patch should return 200", ownerListPatch);

    const initialPlace = await getAdminPlace(memberToken, SMOKE_PLACE_ID);
    assert(initialPlace.status === 200, "Member place detail before write should return 200", initialPlace);
    originalPlace = initialPlace.body?.place;
    assert(Boolean(originalPlace?.id), "Member place detail should include place payload", initialPlace);

    const smokeParkingNote = `Smoke parking ${Date.now()}`;
    const placeWrite = await upsertPlace(memberToken, buildPlacePayload(originalPlace, { parkingNote: smokeParkingNote }));
    assert(placeWrite.status === 200, "Member place write should return 200", placeWrite);
    assert(placeWrite.body?.place?.id === SMOKE_PLACE_ID, "Member place write should return smoke place", placeWrite);
    assert(placeWrite.body?.place?.parkingNote === smokeParkingNote, "Member place write should persist changed field", placeWrite);
    placeChanged = true;

    const archived = await archivePlace(memberToken, SMOKE_PLACE_ID, true);
    assert(archived.status === 200, "Member archive place should return 200", archived);
    assert(Boolean(archived.body?.place?.archivedAt), "Archived place should include archivedAt", archived);

    const restored = await archivePlace(memberToken, SMOKE_PLACE_ID, false);
    assert(restored.status === 200, "Member restore place should return 200", restored);
    assert(restored.body?.place?.archivedAt === null, "Restored place archivedAt should be null", restored);

    const placeRestored = await upsertPlace(memberToken, buildPlacePayload(originalPlace));
    assert(placeRestored.status === 200, "Member place restore should return 200", placeRestored);
    assert(placeRestored.body?.place?.parkingNote === originalPlace.parkingNote, "Member place restore should restore field", placeRestored);
    placeChanged = false;

    const listPlaces = await getListPlaces(ownerToken, LIST_SLUG);
    assert(listPlaces.status === 200, "Owner list places should return 200", listPlaces);
    const originalIds = takeFirstPlaceIds(listPlaces);
    assert(originalIds.length >= 2, "List should include at least two places for reorder smoke", listPlaces);

    const swappedIds = [originalIds[1], originalIds[0]];
    const swapped = await reorderListPlaces(memberToken, LIST_SLUG, swappedIds);
    assert(swapped.status === 200, "Member reorder list places should return 200", swapped);
    assert(swapped.body?.result?.updated === 2, "Reorder should update two places", swapped);

    const duplicateOrder = await reorderListPlaces(memberToken, LIST_SLUG, [originalIds[0], originalIds[0]]);
    assert(duplicateOrder.status === 400, "Duplicate order payload should return 400", duplicateOrder);

    const restoredOrder = await reorderListPlaces(memberToken, LIST_SLUG, originalIds);
    assert(restoredOrder.status === 200, "Member restore list order should return 200", restoredOrder);

    const memberAddForbidden = await upsertMember(memberToken, TARGET_MEMBER_USERNAME, "viewer");
    assert(memberAddForbidden.status === 403, "Member cannot manage team members", memberAddForbidden);

    const ownerAddMember = await upsertMember(ownerToken, TARGET_MEMBER_USERNAME, "viewer");
    assert(ownerAddMember.status === 200, "Owner add member should return 200", ownerAddMember);
    const targetMember = findMember(ownerAddMember, TARGET_MEMBER_USERNAME);
    assert(targetMember?.role === "viewer", "Owner add member should set viewer role", ownerAddMember);
    targetMemberId = targetMember.userId;

    const ownerRemoveMember = await removeMember(ownerToken, targetMember.userId);
    assert(ownerRemoveMember.status === 200, "Owner remove member should return 200", ownerRemoveMember);
    assert(!findMember(ownerRemoveMember, TARGET_MEMBER_USERNAME), "Owner remove member should clear role", ownerRemoveMember);
    targetMemberId = null;
  } finally {
    if (targetMemberId) {
      await removeMember(ownerToken, targetMemberId).catch(() => {});
    }

    if (placeChanged && originalPlace) {
      await archivePlace(memberToken, SMOKE_PLACE_ID, false).catch(() => {});
      await upsertPlace(memberToken, buildPlacePayload(originalPlace)).catch(() => {});
    }

    if (smokeListCreated) {
      await deleteList(ownerToken, SMOKE_LIST_SLUG).catch(() => {});
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: getBaseUrl(),
        checks: [
          "owner/member/external login",
          "external list write rejected",
          "viewer admin list read allowed",
          "viewer admin place reads allowed",
          "viewer admin list write rejected",
          "member list create rejected",
          "owner list create, patch, and delete",
          "member place write and restore",
          "member archive and restore place",
          "member reorder and restore list places",
          "duplicate reorder rejected",
          "member team management rejected",
          "owner add and remove member",
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
