import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const authEventInput = z.object({
  provider: z.literal("google"),
  event: z.enum(["start", "success", "error", "timeout", "redirected"]),
  reason: z.string().max(300).optional(),
});

/** Only same-origin browser clients may write telemetry. */
function isSameOrigin(request: Request) {
  const host = request.headers.get("host");
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!host || !source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

/**
 * Public telemetry sink for sign-in outcomes. Sign-in failures happen before a
 * session exists, so this endpoint is unauthenticated by necessity; it accepts
 * only a bounded, non-PII payload from same-origin clients and never reads data back.
 */
export const Route = createFileRoute("/api/public/auth-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) {
          return new Response("Forbidden", { status: 403 });
        }

        // Reject oversized bodies before parsing.
        const declared = Number(request.headers.get("content-length") ?? "0");
        if (declared > 2048) {
          return new Response("Payload too large", { status: 413 });
        }

        let parsed;
        try {
          const raw = await request.text();
          if (raw.length > 2048) {
            return new Response("Payload too large", { status: 413 });
          }
          parsed = authEventInput.parse(JSON.parse(raw));
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
