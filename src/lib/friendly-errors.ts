/**
 * Maps low-level database/PostgREST errors into messages a person can act on,
 * so a revoked grant or RLS gap surfaces as a clear notice instead of a raw
 * Postgres string (or a blank error screen).
 */
const PERMISSION_DENIED_FUNCTION = /permission denied for function ([a-z0-9_]+)/i;

export function friendlyErrorMessage(input: unknown): string {
  const raw =
    input instanceof Error
      ? input.message
      : typeof input === "string"
        ? input
        : ((input as { message?: string } | null)?.message ?? "");

  if (!raw) return "Something went wrong. Please try again.";

  const fnMatch = raw.match(PERMISSION_DENIED_FUNCTION);
  if (fnMatch) {
    return `We couldn't check your access permissions right now (database rule "${fnMatch[1]}" is unavailable). This is on our side — please retry in a moment, and contact support if it keeps happening.`;
  }

  if (/permission denied for (table|relation|schema)/i.test(raw)) {
    return "You don't have access to this data. If you think that's wrong, ask the account owner to re-invite you or contact support.";
  }

  if (/row-level security|violates row-level security policy/i.test(raw)) {
    return "That action isn't allowed for your account. Sign in again, or ask the account owner for access.";
  }

  if (/JWT|not authenticated|Unauthorized|401/i.test(raw)) {
    return "Your session expired. Please sign in again.";
  }

  return raw;
}

/** Wraps a thrown error so callers keep an Error type but a friendly message. */
export function toFriendlyError(input: unknown): Error {
  return new Error(friendlyErrorMessage(input));
}
