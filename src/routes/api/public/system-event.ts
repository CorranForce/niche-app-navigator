import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Same-origin browser sink for client-side failures that happen before (or
 * outside) an authenticated session — chiefly OAuth consent-screen errors.
 * The payload is bounded, non-PII and write-only; nothing is ever read back.
 */
const payload = z.object({
  source: z.enum(["consent", "oauth"]),
  event: z.string().max(80),
  message: z.string().max(300).optional(),
  clientName: z.string().max(120).optional(),
});

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

export const Route = createFileRoute("/api/public/system-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isSameOrigin(request)) return new Response("Forbidden", { status: 403 });
        if (Number(request.headers.get("content-length") ?? "0") > 2048) {
          return new Response("Payload too large", { status: 413 });
        }

        let parsed: z.infer<typeof payload>;
        try {
          const raw = await request.text();
          if (raw.length > 2048) return new Response("Payload too large", { status: 413 });
          parsed = payload.parse(JSON.parse(raw));
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const { recordSystemEvent } = await import("@/lib/monitoring.server");
        await recordSystemEvent({
          source: parsed.source,
          severity: "warning",
          event: parsed.event,
          message: parsed.message ?? null,
          context: {
            clientName: parsed.clientName ?? null,
            userAgent: (request.headers.get("user-agent") ?? "").slice(0, 200) || null,
          },
        });

        return new Response(null, { status: 204 });
      },
    },
  },
});
