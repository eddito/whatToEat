export const USERNAME_PATTERN = /^[a-z][a-z0-9]{2,31}$/;

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  return USERNAME_PATTERN.test(username);
}

export function getInternalEmailForUsername(username: string) {
  return `${username}@users.what-to-eat-today.invalid`;
}
