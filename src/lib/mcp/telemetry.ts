/**
 * MCP-side monitoring helper. Records tool failures into the same
 * `public.system_events` feed the owner dashboard reads. Import-safe: the
 * server-only monitoring module is loaded lazily inside the call.
 */
export async function reportMcpError(
  tool: string,
  message: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { recordSystemEvent } = await import("@/lib/monitoring.server");
    await recordSystemEvent({
      source: "mcp",
      severity: "warning",
      event: `mcp.${tool}_error`,
      message,
      context: { tool, ...extra },
    });
  } catch {
    // Monitoring must never break a tool call.
  }
}

/** Wraps a tool result helper: logs the failure and returns an MCP error result. */
export async function mcpError(tool: string, message: string, extra?: Record<string, unknown>) {
  await reportMcpError(tool, message, extra);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
