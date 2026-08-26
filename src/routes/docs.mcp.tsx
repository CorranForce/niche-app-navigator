import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";

const SITE = "https://idea-spark-fast.lovable.app";

type ToolDoc = {
  name: string;
  title: string;
  auth: "Public" | "Signed-in user";
  description: string;
  input: string;
  example: string;
  result: string;
};

const TOOLS: ToolDoc[] = [
  {
    name: "list_use_cases",
    title: "List pain-point use cases",
    auth: "Public",
    description:
      "Browse the public catalogue of common niche pain-point types, the app shapes that fix them, target niches and example workflows. Pass a slug to fetch a single entry.",
    input: '{ "slug"?: string }',
    example: `{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_use_cases",
    "arguments": { "slug": "scheduling-and-no-shows" }
  }
}`,
    result: "The matching use case with its pain points, app shape, target niches and workflows.",
  },
  {
    name: "list_reports",
    title: "List reports",
    auth: "Signed-in user",
    description:
      "List the connected user's saved niche reports, newest first, with id, niche, audience, budget and creation date.",
    input: '{ "limit"?: number (1-50, default 10), "search"?: string }',
    example: `{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "list_reports",
    "arguments": { "limit": 5, "search": "dental" }
  }
}`,
    result: "An array of report summaries. Use the id with get_report to read one in full.",
  },
  {
    name: "get_report",
    title: "Get report",
    auth: "Signed-in user",
    description:
      "Fetch one saved report in full: pain points, app concepts, pricing tiers and the 72-hour build plan.",
    input: '{ "id": string }',
    example: `{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_report",
    "arguments": { "id": "00000000-0000-0000-0000-000000000000" }
  }
}`,
    result: "The full report document, or an error if no report with that id belongs to you.",
  },
  {
    name: "get_account_status",
    title: "Get account status",
    auth: "Signed-in user",
    description:
      "Report the connected user's plan, monthly report allowance, reports used this month and subscription status.",
    input: "{} (no arguments)",
    example: `{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": { "name": "get_account_status", "arguments": {} }
}`,
    result: "Plan name, limit, reports used this month, remaining reports and subscription state.",
  },
];

const STEPS: { title: string; body: string }[] = [
  {
    title: "1. Point your client at the MCP endpoint",
    body: `Use ${SITE}/mcp as the server URL. It speaks MCP Streamable HTTP, so any compliant client (Claude, ChatGPT, Cursor, Codex, or the Lovable connector list) can use it.`,
  },
  {
    title: "2. Let the client discover the auth server",
    body: "The endpoint answers unauthenticated requests with a 401 and a pointer to /.well-known/oauth-protected-resource, which names the OAuth 2.1 authorization server. Clients follow this automatically — you do not configure an issuer by hand.",
  },
  {
    title: "3. Register — no client secret needed",
    body: "Dynamic client registration is enabled, so the client registers itself on first connection. There is no API key to copy and nothing to paste into the app.",
  },
  {
    title: "4. Sign in and approve the consent screen",
    body: "Your browser opens the app's sign-in page (email or Google), then a consent screen naming the client. Approve it and the client receives a scoped access token.",
  },
  {
    title: "5. Call tools as yourself",
    body: "Every request runs as your account with the same row-level permissions the web app uses: you see only your own reports and account status. Revoke access any time from Account, and the owner dashboard tracks every connection.",
  },
];

export const Route = createFileRoute("/docs/mcp")({
  head: () => ({
    meta: [
      { title: "MCP API for AI agents — MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "Connect Claude, ChatGPT or Cursor to MicroSaaS Solution Finder over MCP. OAuth setup steps, endpoint details and example requests for every tool.",
      },
      { property: "og:type", content: "article" },
      { property: "og:title", content: "MCP API for AI agents — MicroSaaS Solution Finder" },
      {
        property: "og:description",
        content:
          "OAuth setup steps and example MCP requests for listing niche reports, reading a report and checking plan usage from an AI agent.",
      },
      { property: "og:image", content: `${SITE}/og-image.jpg` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MCP API for AI agents — MicroSaaS Solution Finder" },
      {
        name: "twitter:description",
        content: "Connect your AI agent over MCP: OAuth setup and example requests for each tool.",
      },
      { name: "twitter:image", content: `${SITE}/og-image.jpg` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/docs/mcp` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE },
            { "@type": "ListItem", position: 2, name: "MCP API", item: `${SITE}/docs/mcp` },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: "MCP API for AI agents",
          description:
            "How to connect an AI agent to MicroSaaS Solution Finder over the Model Context Protocol, including OAuth setup and example tool requests.",
          url: `${SITE}/docs/mcp`,
        }),
      },
    ],
  }),
  component: McpDocsPage,
});

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
      <code>{children}</code>
    </pre>
  );
}

function McpDocsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <nav aria-label="Breadcrumb" className="label-mono text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>{" "}
          / MCP API
        </nav>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">MCP API for AI agents</h1>
        <p className="mt-3 text-muted-foreground">
          MicroSaaS Solution Finder ships a Model Context Protocol server, so an AI agent can browse
          the pain-point catalogue, read your saved niche reports and check your plan usage — as
          you, with your permissions.
        </p>

        <Card className="mt-6 gap-2 border-border bg-surface p-4 font-mono text-sm">
          <p>
            <span className="text-muted-foreground">Endpoint</span> {SITE}/mcp
          </p>
          <p>
            <span className="text-muted-foreground">Transport</span> MCP Streamable HTTP
          </p>
          <p>
            <span className="text-muted-foreground">Auth</span> OAuth 2.1 + dynamic client
            registration
          </p>
          <p>
            <span className="text-muted-foreground">Metadata</span>{" "}
            {SITE}/.well-known/oauth-protected-resource
          </p>
        </Card>

        <h2 className="mt-10 text-xl font-semibold tracking-tight">Connecting with OAuth</h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map((step) => (
            <li key={step.title}>
              <Card className="gap-1 border-border bg-surface p-4">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>

        <h2 className="mt-10 text-xl font-semibold tracking-tight">Tools</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Requests are JSON-RPC 2.0 over HTTP POST with an{" "}
          <code className="font-mono">Authorization: Bearer</code> access token and{" "}
          <code className="font-mono">Accept: application/json, text/event-stream</code>. Your MCP
          client handles both headers for you.
        </p>

        <div className="mt-4 space-y-4">
          {TOOLS.map((tool) => (
            <Card key={tool.name} className="gap-2 border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-sm font-semibold">{tool.name}</h3>
                <span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {tool.auth}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{tool.description}</p>
              <p className="font-mono text-xs text-muted-foreground">Input: {tool.input}</p>
              <Code>{tool.example}</Code>
              <p className="text-xs text-muted-foreground">Returns: {tool.result}</p>
            </Card>
          ))}
        </div>

        <h2 className="mt-10 text-xl font-semibold tracking-tight">Raw HTTP example</h2>
        <Code>{`curl -X POST ${SITE}/mcp \\
  -H "Authorization: Bearer <access-token>" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}</Code>
        <p className="mt-3 text-sm text-muted-foreground">
          Without a token the endpoint returns 401 with a{" "}
          <code className="font-mono">WWW-Authenticate</code> header pointing at the resource
          metadata — that is the handshake your client uses to start the OAuth flow.
        </p>

        <Card className="mt-8 gap-2 border-border bg-surface p-4">
          <p className="text-sm font-medium">Managing access</p>
          <p className="text-sm text-muted-foreground">
            Connected agents act with your account's permissions and never see other users' data.
            You can review linked identities and your plan from{" "}
            <Link to="/account" className="underline underline-offset-4">
              Account &amp; billing
            </Link>
            , or read the{" "}
            <Link to="/faq" className="underline underline-offset-4">
              FAQ
            </Link>{" "}
            for plan limits that apply to agent requests too.
          </p>
        </Card>
      </main>
    </div>
  );
}
