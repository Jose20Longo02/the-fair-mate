export const MIN_USERNAME_LENGTH = 2;
export const MAX_USERNAME_LENGTH = 50;
export const USERNAME_REGEX = /^[A-Za-z0-9_]+$/;

export function validateUsernameFormat(raw: string): { ok: boolean; reason?: string; normalized: string } {
  const normalized = raw.trim();
  if (normalized.length < MIN_USERNAME_LENGTH) {
    return {
      ok: false,
      reason: normalized.length > 0 ? `At least ${MIN_USERNAME_LENGTH} characters` : "Enter a username",
      normalized,
    };
  }
  if (normalized.length > MAX_USERNAME_LENGTH) {
    return { ok: false, reason: `Maximum ${MAX_USERNAME_LENGTH} characters`, normalized };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return {
      ok: false,
      reason: "Only letters, numbers, and underscore (_)",
      normalized,
    };
  }
  return { ok: true, normalized };
}
