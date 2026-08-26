import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { USE_CASES } from "@/lib/use-cases";

export default defineTool({
  name: "list_use_cases",
  title: "List pain-point use cases",
  description:
    "Browse the app's public catalogue of common niche pain-point types, the app shapes that fix them, target niches and example workflows.",
  inputSchema: {
    slug: z
      .string()
      .optional()
      .describe("Return a single use case by slug (e.g. scheduling-and-no-shows)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ slug }) => {
    const items = slug ? USE_CASES.filter((u) => u.slug === slug) : USE_CASES;
    if (slug && items.length === 0) {
      return {
        content: [{ type: "text", text: `No use case with slug "${slug}".` }],
        isError: true,
      };
    }
    const payload = items.map((u) => ({
      slug: u.slug,
      painType: u.painType,
      title: u.title,
      tagline: u.tagline,
      description: u.description,
      signals: u.signals,
      appShapes: u.appShapes,
      niches: u.niches,
      workflow: u.workflow,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: { useCases: payload },
    };
  },
});
