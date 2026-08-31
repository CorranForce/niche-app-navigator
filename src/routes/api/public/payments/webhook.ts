import { createFileRoute } from "@tanstack/react-router";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { verifyWebhook, type PaddleEnv } from "@/lib/paddle.server";
import { applyPaddleEvent, normalisedOccurredAt } from "@/lib/webhook-apply.server";

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  // Paddle stamps every event; fall back to arrival time if it is ever absent.
  const occurredAt = normalisedOccurredAt(
    (event as any)?.occurredAt ?? (event as any)?.occurred_at,
  );

  if (!event?.data || typeof event.data !== "object") {
    throw new Error("Webhook payload is missing an event data object");
  }

  await applyPaddleEvent({
    eventType: event.eventType as string,
    data: event.data,
    env,
    occurredAt,
  });
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          // Defence in depth: only Paddle's published IP ranges may post here.
          const { checkPaddleSourceIp } = await import("@/lib/paddle-ips.server");
          const ipCheck = await checkPaddleSourceIp(request);
          if (!ipCheck.allowed) {
            const { recordSystemEvent } = await import("@/lib/monitoring.server");
            await recordSystemEvent({
              source: "webhook",
              severity: "warning",
              event: "paddle.webhook_ip_rejected",
              message: `Rejected webhook from non-Paddle IP ${ipCheck.ip}.`,
              context: { env, ip: ipCheck.ip },
            });
            return new Response("Forbidden", { status: 403 });
          }
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          const { recordSystemEvent, describeError } = await import("@/lib/monitoring.server");
          await recordSystemEvent({
            source: "webhook",
            severity: "critical",
            event: "paddle.webhook_failed",
            message: describeError(e),
            context: { env, path: url.pathname },
          });
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
