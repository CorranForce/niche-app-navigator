import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type McpClientRow = {
  id: string;
  clientName: string | null;
  clientUri: string | null;
  registrationType: string | null;
  createdAt: string | null;
  consents: number;
  activeConsents: number;
  lastGrantedAt: string | null;
  authorizations: number;
  approvedAuthorizations: number;
  lastAuthorizedAt: string | null;
};

export type McpConsentRow = {
  id: string;
  clientName: string | null;
  userEmail: string | null;
  scopes: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
};

export type McpIntegrationStatus = {
  endpoint: string;
  metadataPath: string;
  issuer: string;
  toolCount: number;
  tools: Array<{ name: string; title: string; readOnly: boolean }>;
  clients: McpClientRow[];
  consents: McpConsentRow[];
  authorizationStats: Array<{ status: string; total: number }>;
  errors7d: number;
  lastError: { createdAt: string; event: string; message: string | null } | null;
};

const MCP_ISSUER = `https://${import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset"}.supabase.co/auth/v1`;

/** Mirrors the tools registered in src/lib/mcp/index.ts. */
const MCP_TOOLS: Array<{ name: string; title: string; readOnly: boolean }> = [
  { name: "list_use_cases", title: "List pain-point use cases", readOnly: true },
  { name: "list_reports", title: "List reports", readOnly: true },
  { name: "get_report", title: "Get report", readOnly: true },
  { name: "get_account_status", title: "Get account status", readOnly: true },
];

/** Owner-only snapshot of the app's MCP server, connected clients and consent history. */
export const getMcpIntegrationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<McpIntegrationStatus> => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Could not verify access.");
    if (!isAdmin) throw new Error("Admins only.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;

    const [clientsRes, consentsRes, statsRes, errorsRes] = await Promise.all([
      db.rpc("admin_mcp_clients", { _actor: context.userId }),
      db.rpc("admin_mcp_consents", { _actor: context.userId, _limit: 50 }),
      db.rpc("admin_mcp_authorization_stats", { _actor: context.userId, _days: 30 }),
      db
        .from("system_events")
        .select("created_at, event, message")
        .eq("source", "mcp")
        .gt("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const tools = MCP_TOOLS;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorRows = (errorsRes.data ?? []) as any[];

    return {
      endpoint: "/mcp",
      metadataPath: "/.well-known/oauth-protected-resource",
      issuer: MCP_ISSUER,
      toolCount: tools.length,
      tools,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clients: ((clientsRes.data ?? []) as any[]).map((row) => ({
        id: String(row.id),
        clientName: row.client_name ?? null,
        clientUri: row.client_uri ?? null,
        registrationType: row.registration_type ?? null,
        createdAt: row.created_at ?? null,
        consents: Number(row.consents ?? 0),
        activeConsents: Number(row.active_consents ?? 0),
        lastGrantedAt: row.last_granted_at ?? null,
        authorizations: Number(row.authorizations ?? 0),
        approvedAuthorizations: Number(row.approved_authorizations ?? 0),
        lastAuthorizedAt: row.last_authorized_at ?? null,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      consents: ((consentsRes.data ?? []) as any[]).map((row) => ({
        id: String(row.id),
        clientName: row.client_name ?? null,
        userEmail: row.user_email ?? null,
        scopes: row.scopes ?? null,
        grantedAt: row.granted_at ?? null,
        revokedAt: row.revoked_at ?? null,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      authorizationStats: ((statsRes.data ?? []) as any[]).map((row) => ({
        status: String(row.status ?? "unknown"),
        total: Number(row.total ?? 0),
      })),
      errors7d: errorRows.length,
      lastError: errorRows[0]
        ? {
            createdAt: String(errorRows[0].created_at),
            event: String(errorRows[0].event),
            message: errorRows[0].message ?? null,
          }
        : null,
    };
  });
