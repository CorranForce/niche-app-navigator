import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { mcpError } from "../telemetry";

export default defineTool({
  name: "get_report",
  title: "Get report",
  description:
    "Fetch one saved niche report in full, including pain points, app concepts, pricing tiers and the 72-hour build plan.",
  inputSchema: { id: z.string().describe("Report id, as returned by list_reports.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return await mcpError("get_report", "Not authenticated");
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("reports")
      .select("id, niche, audience, budget, created_at, payload")
      .eq("id", id)
      .maybeSingle();

    if (error) return await mcpError("get_report", error.message);
    if (!data) {
      return { content: [{ type: "text", text: `No report found with id ${id}.` }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { report: data },
    };
  },
});
