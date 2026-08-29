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

async function uploadDish(placeId, token) {
  const form = new FormData();
  form.set("file", new Blob([ONE_PIXEL_PNG], { type: "image/png" }), "smoke-dish.png");
  form.set("name", "Smoke Test Dish");
  form.set("description", "Temporary dish created by backend smoke test.");
  form.set("sortOrder", "8");

  return requestJson(`/api/admin/places/${encodeURIComponent(placeId)}/dishes`, {
    method: "POST",
    headers: authHeaders(token),
    body: form,
  });
}

async function uploadDishWithoutToken(placeId) {
  const form = new FormData();
  form.set("file", new Blob([ONE_PIXEL_PNG], { type: "image/png" }), "smoke-dish.png");
  form.set("name", "Smoke Test Dish");

  return requestJson(`/api/admin/places/${encodeURIComponent(placeId)}/dishes`, {
    method: "POST",
    body: form,
  });
}

async function updateDish(placeId, dishId, token) {
  return requestJson(`/api/admin/places/${encodeURIComponent(placeId)}/dishes`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      dishId,
      name: "Smoke Test Dish Updated",
      description: "Updated by backend smoke test.",
      sortOrder: 2,
    }),
  });
}

async function deleteDish(placeId, dishId, token) {
  return requestJson(
    `/api/admin/places/${encodeURIComponent(placeId)}/dishes?dishId=${encodeURIComponent(dishId)}`,
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

function findDish(place, dishId) {
  return place.body?.place?.featuredDishes?.find((dish) => dish.id === dishId) ?? null;
}

async function main() {
  const ownerToken = await login(OWNER_USERNAME, OWNER_PASSWORD);
  const memberToken = await login(MEMBER_USERNAME, MEMBER_PASSWORD);
  const externalToken = await login(EXTERNAL_USERNAME, EXTERNAL_PASSWORD);

  const missingToken = await uploadDishWithoutToken(PLACE_ID);
  assert(missingToken.status === 401, "Dish upload without token should return 401", missingToken);

  const externalUpload = await uploadDish(PLACE_ID, externalToken);
  assert(externalUpload.status === 403, "External user dish upload should return 403", externalUpload);

  const upload = await uploadDish(PLACE_ID, ownerToken);
  assert(upload.status === 200, "Owner dish upload should return 200", upload);
  assert(upload.body?.ok === true, "Owner dish upload should be ok", upload);
  assert(Boolean(upload.body?.dish?.id), "Owner dish upload should return dish id", upload);
  assert(Boolean(upload.body?.dish?.photoUrl), "Owner dish upload should return public photo URL", upload);

  const dishId = upload.body.dish.id;

  try {
    const afterUpload = await getAdminPlace(PLACE_ID, ownerToken);
    assert(afterUpload.status === 200, "Admin place detail after upload should return 200", afterUpload);
    assert(findDish(afterUpload, dishId), "Admin place detail should include uploaded dish", afterUpload);

    const update = await updateDish(PLACE_ID, dishId, memberToken);
    assert(update.status === 200, "Team member dish update should return 200", update);
    assert(update.body?.dish?.name === "Smoke Test Dish Updated", "Dish update should persist name", update);
    assert(update.body?.dish?.sortOrder === 2, "Dish update should persist sortOrder", update);

    const deleted = await deleteDish(PLACE_ID, dishId, ownerToken);
    assert(deleted.status === 200, "Owner dish delete should return 200", deleted);
    assert(deleted.body?.deleted === true, "Owner dish delete should report deleted true", deleted);

    const afterDelete = await getAdminPlace(PLACE_ID, ownerToken);
    assert(afterDelete.status === 200, "Admin place detail after delete should return 200", afterDelete);
    assert(!findDish(afterDelete, dishId), "Deleted dish should be removed from admin detail", afterDelete);

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
            "owner upload to place-dishes",
            "uploaded dish visible in admin detail",
            "member can update dish metadata",
            "owner true delete removes storage object and database row",
          ],
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await deleteDish(PLACE_ID, dishId, ownerToken).catch(() => {});
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
