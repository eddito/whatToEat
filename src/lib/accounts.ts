export const USERNAME_EMAIL_DOMAIN = "users.what-to-eat-today.invalid";
export const USERNAME_PATTERN = /^[a-z][a-z0-9]{2,31}$/;
export const PHONE_PATTERN = /^\+?\d{6,15}$/;

export function isUsernameAccount(account: string) {
  return USERNAME_PATTERN.test(account.trim());
}

export function getLoginCredentials(account: string, password: string) {
  const loginAccount = account.trim();

  if (loginAccount.includes("@")) {
    return { email: loginAccount, password };
  }

  if (PHONE_PATTERN.test(loginAccount)) {
    return { phone: loginAccount, password };
  }

  return { email: `${loginAccount.toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`, password };
}
