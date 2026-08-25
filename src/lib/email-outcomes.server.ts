/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";

let _admin: ReturnType<typeof createClient<any, any, any>> | null = null;
function admin() {
  if (!_admin) {
    _admin = createClient<any, any, any>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _admin;
}

/**
 * Reacts to a terminal delivery outcome for one recipient.
 *
 * This is a notification/visibility path only — Lovable already blocks further
 * sends to bounced, complained or unsubscribed recipients at send time, and
 * retries transient failures itself. Nothing here gates future sends.
 */
export async function flagUndeliverableCustomer(
  recipient: string,
  outcome: "bounced" | "complaint" | "unsubscribed",
  eventId: string,
) {
  // Resolve the account behind the address so admins can see who is affected.
  let userId: string | null = null;
  try {
    const { data } = await admin().auth.admin.listUsers({ page: 1, perPage: 200 });
    userId =
      (data?.users ?? []).find(
        (u: any) => (u.email ?? "").toLowerCase() === recipient.toLowerCase(),
      )?.id ?? null;
  } catch {
    userId = null;
  }

  // Idempotent by event id: redeliveries log the same line without side effects.
  console.warn("email delivery outcome", {
    event_id: eventId,
    outcome,
    matched_account: Boolean(userId),
  });
}
