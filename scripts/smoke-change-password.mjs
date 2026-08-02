const DEFAULT_BASE_URL = "http://127.0.0.1:3101";
const USERNAME = "testuser";
const ORIGINAL_PASSWORD = "TestUser_2026";
const TEMP_PASSWORD = "TempUser_2026";
const CONTACT_EMAIL = "testuser@example.com";

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

async function login(password) {
  return requestJson("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: USERNAME,
      password,
    }),
  });
}

async function changePassword(contact, newPassword) {
  return requestJson("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      username: USERNAME,
      contact,
      newPassword,
    }),
  });
}

async function ensureOriginalPassword() {
  const originalLogin = await login(ORIGINAL_PASSWORD);

  if (originalLogin.status === 200) {
    return;
  }

  const tempLogin = await login(TEMP_PASSWORD);

  if (tempLogin.status !== 200) {
    throw new Error(
      `Cannot confirm current test password.\n${JSON.stringify({ originalLogin, tempLogin }, null, 2)}`,
    );
  }

  const reset = await changePassword(CONTACT_EMAIL, ORIGINAL_PASSWORD);
  assert(reset.status === 200, "Reset to original password should return 200", reset);
}

async function main() {
  await ensureOriginalPassword();

  const mismatch = await changePassword("wrong@example.com", TEMP_PASSWORD);
  assert(mismatch.status === 400, "Wrong contact should return 400", mismatch);
  assert(mismatch.body?.error === "contact_mismatch", "Wrong contact should return contact_mismatch", mismatch);

  const changed = await changePassword(CONTACT_EMAIL, TEMP_PASSWORD);
  assert(changed.status === 200, "Password change should return 200", changed);
  assert(changed.body?.user?.username === USERNAME, "Password change should return username", changed);

  const oldLogin = await login(ORIGINAL_PASSWORD);
  assert(oldLogin.status === 401, "Old password should stop working", oldLogin);

  const newLogin = await login(TEMP_PASSWORD);
  assert(newLogin.status === 200, "New password should work", newLogin);

  const restored = await changePassword(CONTACT_EMAIL, ORIGINAL_PASSWORD);
  assert(restored.status === 200, "Restore original password should return 200", restored);

  const restoredLogin = await login(ORIGINAL_PASSWORD);
  assert(restoredLogin.status === 200, "Original password should work after restore", restoredLogin);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl: getBaseUrl(),
        checks: [
          "wrong contact rejected",
          "email contact changes password",
          "old password rejected",
          "new password accepted",
          "original password restored",
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
