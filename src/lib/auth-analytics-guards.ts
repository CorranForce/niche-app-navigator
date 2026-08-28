import { z } from "zod";

/** Hard caps: a page can never be widened or walked past these bounds. */
export const MAX_PAGE_SIZE = 50;
export const MAX_PAGE = 19;
export const AGGREGATE_ROW_CAP = 5000;
export const MAX_REASON_CHARS = 200;

/**
 * Input contract for the admin auth-event log. `.strict()` rejects unknown keys
 * so a caller can never smuggle extra filters/columns into the query, and the
 * page bounds cap how much of the telemetry table one request can surface.
 */
export const authAnalyticsInput = z
  .object({
    days: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(14),
    page: z.number().int().min(0).max(MAX_PAGE).default(0),
    pageSize: z.number().int().min(5).max(MAX_PAGE_SIZE).default(25),
  })
  .strict();

export type AuthAnalyticsInput = z.infer<typeof authAnalyticsInput>;

/** Clamp a validated page request into an absolute row window. */
export function pageRange(input: { page: number; pageSize: number }) {
  const pageSize = Math.min(Math.max(input.pageSize, 5), MAX_PAGE_SIZE);
  const page = Math.min(Math.max(input.page, 0), MAX_PAGE);
  const from = page * pageSize;
  return { page, pageSize, from, to: from + pageSize - 1 };
}

/** Trim free-text failure reasons so a long reason can't leak a payload. */
export function truncateReason(reason: string | null): string | null {
  return reason ? reason.slice(0, MAX_REASON_CHARS) : null;
}

/** Whether another page exists, honouring the absolute depth ceiling. */
export function hasMorePages(args: {
  page: number;
  from: number;
  returned: number;
  total: number;
}) {
  return args.from + args.returned < args.total && args.page < MAX_PAGE;
}
