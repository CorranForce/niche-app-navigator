/**
 * Paddle publishes the IPs its webhooks originate from at
 * https://api.paddle.com/ips. The list changes, so it is fetched at runtime and
 * cached — never hard-coded. Signature verification stays the primary control;
 * the allowlist is defence in depth.
 */
const IPS_URL = "https://api.paddle.com/ips";
const TTL_MS = 60 * 60 * 1000;

let cache: { at: number; cidrs: string[] } | null = null;

export async function getPaddleWebhookCidrs(): Promise<string[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.cidrs;
  const res = await fetch(IPS_URL);
  if (!res.ok) throw new Error(`Paddle IP list returned ${res.status}`);
  const body = (await res.json()) as { data?: { ipv4_cidrs?: string[] } };
  const cidrs = body.data?.ipv4_cidrs ?? [];
  if (cidrs.length === 0) throw new Error("Paddle IP list was empty");
  cache = { at: Date.now(), cidrs };
  return cidrs;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = (value << 8) | n;
  }
  return value >>> 0;
}

export function ipInCidrs(ip: string, cidrs: string[]): boolean {
  const addr = ipv4ToInt(ip);
  if (addr === null) return false;
  return cidrs.some((cidr) => {
    const [base, bitsRaw] = cidr.split("/");
    const baseInt = ipv4ToInt(base ?? "");
    const bits = Number(bitsRaw ?? 32);
    if (baseInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (addr & mask) >>> 0 === (baseInt & mask) >>> 0;
  });
}

/** Extracts the originating client IP from proxy headers. */
export function clientIpFrom(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? null;
}

export type IpCheck = { allowed: boolean; reason: string; ip: string | null };

/**
 * Rejects requests from IPs outside Paddle's published ranges. When the source
 * IP cannot be determined (some proxy hops strip it) or the list is
 * unreachable, the request is allowed through and the signature check decides —
 * failing closed there would drop legitimate deliveries.
 */
export async function checkPaddleSourceIp(request: Request): Promise<IpCheck> {
  const ip = clientIpFrom(request);
  if (!ip) return { allowed: true, reason: "ip_unknown", ip: null };
  if (ip.includes(":")) return { allowed: true, reason: "ipv6_not_listed", ip };
  try {
    const cidrs = await getPaddleWebhookCidrs();
    return ipInCidrs(ip, cidrs)
      ? { allowed: true, reason: "allowlisted", ip }
      : { allowed: false, reason: "not_allowlisted", ip };
  } catch {
    return { allowed: true, reason: "ip_list_unavailable", ip };
  }
}
