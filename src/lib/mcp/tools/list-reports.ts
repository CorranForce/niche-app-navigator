import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { mcpError } from "../telemetry";

export default defineTool({
  name: "list_reports",
  title: "List reports",
  description:
    "List the signed-in user's saved micro-SaaS niche reports (newest first), with id, niche, audience, budget and creation date.",
  inputSchema: {
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("How many reports to return (default 10)."),
    search: z.string().optional().describe("Optional case-insensitive filter on the niche."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return await mcpError("list_reports", "Not authenticated");
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("reports")
      .select("id, niche, audience, budget, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (search?.trim()) query = query.ilike("niche", `%${search.trim()}%`);

    const { data, error } = await query;
    if (error) return await mcpError("list_reports", error.message);

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { reports: data ?? [] },
    };
  },
});
