import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plug, ShieldCheck, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMcpIntegrationStatus } from "@/lib/admin-mcp.functions";

function when(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function McpStatusSection() {
  const fetchStatus = useServerFn(getMcpIntegrationStatus);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-mcp-status"],
    queryFn: () => fetchStatus(),
    retry: false,
  });

  return (
    <section id="mcp" className="mt-10 scroll-mt-20">
      <div className="flex items-center gap-2">
        <Plug className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">Agent integrations (MCP)</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Connected MCP clients, consent history and tool errors for the app's OAuth-protected agent
        endpoint.
      </p>

      {error ? (
        <Card className="mt-4 flex items-center gap-2 border-destructive/40 bg-destructive/10 p-4 text-sm">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          {(error as Error).message}
        </Card>
      ) : null}

      {isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Reading integration status…
        </p>
      ) : data ? (
        <>
          <Card className="mt-4 gap-3 border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {data.endpoint}
              </Badge>
              <Badge variant="outline" className="font-mono">
                OAuth 2.1
              </Badge>
              <Badge variant="outline" className="font-mono">
                {data.toolCount} tools
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> issuer {data.issuer || "not configured"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.tools.map((tool) => (
                <span
                  key={tool.name}
                  className="rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground"
                >
                  {tool.name}
                  {tool.readOnly ? " · read-only" : ""}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.errors7d === 0
                ? "No MCP tool errors in the last 7 days."
                : `${data.errors7d} MCP tool error${data.errors7d === 1 ? "" : "s"} in the last 7 days — latest: ${data.lastError?.event} (${when(data.lastError?.createdAt ?? null)}).`}
            </p>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="gap-0 overflow-hidden border-border bg-surface p-0">
              <p className="label-mono border-b border-border px-4 py-3 text-muted-foreground">
                Connected clients
              </p>
              {data.clients.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No MCP client has registered yet. Clients self-register when they complete the
                  OAuth flow.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {data.clients.map((client) => (
                    <li key={client.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">
                          {client.clientName ?? "Unnamed client"}
                        </span>
                        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {client.activeConsents} active
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {client.registrationType ?? "dynamic"} · {client.approvedAuthorizations}/
                        {client.authorizations} approved · last used {when(client.lastAuthorizedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="gap-0 overflow-hidden border-border bg-surface p-0">
              <p className="label-mono border-b border-border px-4 py-3 text-muted-foreground">
                Consent history
              </p>
              {data.consents.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No consents granted yet.</p>
              ) : (
                <ul className="divide-y divide-border/60 font-mono text-xs">
                  {data.consents.map((consent) => (
                    <li key={consent.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate">{consent.userEmail ?? "unknown user"}</span>
                        <Badge variant={consent.revokedAt ? "destructive" : "outline"}>
                          {consent.revokedAt ? "revoked" : "granted"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {consent.clientName ?? "client"} ·{" "}
                        {when(consent.revokedAt ?? consent.grantedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {data.authorizationStats.length > 0 ? (
            <Card className="mt-4 gap-2 border-border bg-surface p-4">
              <p className="label-mono text-muted-foreground">Authorizations (30d)</p>
              <div className="flex flex-wrap gap-2 font-mono text-xs">
                {data.authorizationStats.map((stat) => (
                  <span key={stat.status} className="rounded-md border border-border px-2 py-1">
                    {stat.status}: {stat.total}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
