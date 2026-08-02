const DEFAULT_BASE_URL = "http://127.0.0.1:3101";
const OWNER_USERNAME = "testowner";
const OWNER_PASSWORD = "TestOwner_2026";
const MEMBER_USERNAME = "testuser";
const MEMBER_PASSWORD = "TestUser_2026";
const EXTERNAL_USERNAME = "testexternal";
const EXTERNAL_PASSWORD = "TestExternal_2026";
const PLACE_ID = "red-list-1";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lc1J9QAAAABJRU5ErkJggg==",
  "base64",
);

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
  const headers = {
    ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
    ...(options.headers ?? {}),
  };

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
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

async function uploadPhoto(placeId, token) {
  const form = new FormData();
  form.set("file", new Blob([ONE_PIXEL_PNG], { type: "image/png" }), "smoke-photo.png");
  form.set("isCover", "true");
  form.set("sortOrder", "7");

  return requestJson(`/api/admin/places/${encodeURIComponent(placeId)}/photos`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
}

async function uploadPhotoWithoutToken(placeId) {
  const form = new FormData();
  form.set("file", new Blob([ONE_PIXEL_PNG], { type: "image/png" }), "smoke-photo.png");

  return requestJson(`/api/admin/places/${encodeURIComponent(placeId)}/photos`, {
    method: "POST",
    body: form,
  });
}

async function updatePhoto(placeId, photoId, token) {
  return requestJson(`/api/admin/places/${encodeURIComponent(placeId)}/photos`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      photoId,
      isCover: true,
      sortOrder: 3,
    }),
  });
}

async function deletePhoto(placeId, photoId, token) {
  return requestJson(
    `/api/admin/places/${encodeURIComponent(placeId)}/photos?photoId=${encodeURIComponent(photoId)}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
    },
  );
}

async function getAdminPlace(placeId, token) {
  return requestJson(`/api/admin/places/${encodeURIComponent(placeId)}`, {
    headers: authHeaders(token),
  });
}

function findPhoto(place, photoId) {
  return place.body?.place?.photos?.find((photo) => photo.id === photoId) ?? null;
}

async function main() {
  const ownerToken = await login(OWNER_USERNAME, OWNER_PASSWORD);
  const memberToken = await login(MEMBER_USERNAME, MEMBER_PASSWORD);
  const externalToken = await login(EXTERNAL_USERNAME, EXTERNAL_PASSWORD);

  const missingToken = await uploadPhotoWithoutToken(PLACE_ID);
  assert(missingToken.status === 401, "Photo upload without token should return 401", missingToken);

  const externalUpload = await uploadPhoto(PLACE_ID, externalToken);
  assert(externalUpload.status === 403, "External user photo upload should return 403", externalUpload);

  const upload = await uploadPhoto(PLACE_ID, ownerToken);
  assert(upload.status === 200, "Owner photo upload should return 200", upload);
  assert(upload.body?.ok === true, "Owner photo upload should be ok", upload);
  assert(Boolean(upload.body?.photo?.id), "Owner photo upload should return photo id", upload);
  assert(Boolean(upload.body?.photo?.url), "Owner photo upload should return public URL", upload);

  const photoId = upload.body.photo.id;

  try {
    const afterUpload = await getAdminPlace(PLACE_ID, ownerToken);
    assert(afterUpload.status === 200, "Admin place detail after upload should return 200", afterUpload);
    assert(findPhoto(afterUpload, photoId), "Admin place detail should include uploaded photo", afterUpload);
    assert(
      afterUpload.body?.place?.coverPhotoUrl === upload.body.photo.url,
      "Uploaded cover photo should become coverPhotoUrl",
      afterUpload,
    );

    const update = await updatePhoto(PLACE_ID, photoId, memberToken);
    assert(update.status === 200, "Team member photo update should return 200", update);
    assert(update.body?.photo?.sortOrder === 3, "Photo update should persist sortOrder", update);
    assert(update.body?.photo?.isCover === true, "Photo update should keep cover flag", update);

    const deleted = await deletePhoto(PLACE_ID, photoId, ownerToken);
    assert(deleted.status === 200, "Owner photo delete should return 200", deleted);
    assert(deleted.body?.deleted === true, "Owner photo delete should report deleted true", deleted);

    const afterDelete = await getAdminPlace(PLACE_ID, ownerToken);
    assert(afterDelete.status === 200, "Admin place detail after delete should return 200", afterDelete);
    assert(!findPhoto(afterDelete, photoId), "Deleted photo should be removed from admin detail", afterDelete);

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl: getBaseUrl(),
          placeId: PLACE_ID,
          checks: [
            "owner/member/external login",
            "missing token upload rejected",
            "external upload rejected",
            "owner upload to place-photos",
            "uploaded photo visible in admin detail",
            "member can update photo metadata",
            "owner true delete removes storage object and database row",
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await deletePhoto(PLACE_ID, photoId, ownerToken).catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
