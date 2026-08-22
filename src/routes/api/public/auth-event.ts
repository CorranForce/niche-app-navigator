import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const authEventInput = z.object({
  provider: z.literal("google"),
  event: z.enum(["start", "success", "error", "timeout", "redirected"]),
  reason: z.string().max(300).optional(),
});
/**
 * Coarse network range only — IPv4 is truncated to /24 and IPv6 to /32, so no
 * full visitor IP address is ever stored.
 */
function coarseIpRange(request: Request): string | null {
  const raw =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip");
  if (!raw) return null;
  if (raw.includes(":")) {
    const parts = raw.split(":").filter(Boolean).slice(0, 2);
    return parts.length ? `${parts.join(":")}::/32` : null;
  }
  const octets = raw.split(".");
  if (octets.length !== 4 || octets.some((o) => !/^\d{1,3}$/.test(o))) return null;
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

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
          ip_prefix: coarseIpRange(request),
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
