import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const authEventInput = z.object({
  provider: z.literal("google"),
  event: z.enum(["start", "success", "error", "timeout", "redirected"]),
  reason: z.string().max(300).optional(),
});

/**
 * Fire-and-forget auth telemetry. Public by design (sign-in failures happen
 * before a session exists) — it only writes a bounded, non-PII row.
 */
export const logAuthEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => authEventInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("auth_events").insert({
      provider: data.provider,
      event: data.event,
      reason: data.reason ?? null,
    });
    if (error) console.error("auth_events insert failed", error.message);
    return { ok: !error };
  });
