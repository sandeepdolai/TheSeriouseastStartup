export const GUEST_ACCOUNT_KEY = "guest";

export function getAccountKey(email?: string | null) {
  const normalized = email?.trim().toLowerCase();
  return normalized ? encodeURIComponent(normalized) : GUEST_ACCOUNT_KEY;
}

export function getAccountStorageKey(key: string, email?: string | null) {
  return `${key}:${getAccountKey(email)}`;
}
