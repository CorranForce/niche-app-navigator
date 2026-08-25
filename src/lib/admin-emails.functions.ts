import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type EmailLogRow = {
  id: string;
  createdAt: string | null;
  eventType: string;
  status: string | null;
  recipient: string | null;
  label: string | null;
  subject: string | null;
};

/** Admin-only view of recent managed email delivery events. */
export const listRecentEmailLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        recipient: z.string().max(200).optional(),
        eventType: z
          .enum([
            "sent",
            "rejected",
            "bounced",
            "complained",
            "unsubscribed",
            "suppressed",
            "rate_limited",
          ])
          .optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<EmailLogRow[]> => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Could not verify access.");
    if (!isAdmin) throw new Error("Admins only.");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Email logs are not available right now.");

    const { listEmailLogs } = await import("@lovable.dev/email-js");
    const result = (await listEmailLogs(
      {
        limit: data.limit,
        ...(data.recipient ? { recipient: data.recipient } : {}),
        ...(data.eventType ? { event_type: data.eventType } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      { apiKey },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )) as any;

    const rows = Array.isArray(result) ? result : (result?.events ?? result?.data ?? []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (rows as any[]).map((row, index) => ({
      id: String(row.id ?? row.event_id ?? `${row.created_at ?? ""}-${index}`),
      createdAt: row.created_at ?? row.createdAt ?? null,
      eventType: String(row.event_type ?? row.eventType ?? "unknown"),
      status: row.status ?? row.reason ?? null,
      recipient: row.recipient ?? row.to ?? null,
      label: row.label ?? null,
      subject: row.subject ?? null,
    }));
  });
