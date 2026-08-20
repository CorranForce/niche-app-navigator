import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const authEventInput = z.object({
  provider: z.literal("google"),
  event: z.enum(["start", "success", "error", "timeout", "redirected"]),
  reason: z.string().max(300).optional(),
});

/**
 * Public telemetry sink for sign-in outcomes. Sign-in failures happen before a
 * session exists, so this endpoint is unauthenticated by necessity; it accepts
 * only a bounded, non-PII payload and never reads data back.
 */
export const Route = createFileRoute("/api/public/auth-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = authEventInput.parse(await request.json());
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("auth_events").insert({
          provider: parsed.provider,
          event: parsed.event,
          reason: parsed.reason ?? null,
          user_agent: (request.headers.get("user-agent") ?? "").slice(0, 400) || null,
        });
        if (error) {
          console.error("auth_events insert failed", error.message);
          return new Response("Insert failed", { status: 500 });
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
