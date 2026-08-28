import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EffectiveEntitlement } from "@/lib/entitlement";

/**
 * Entitlement for the signed-in caller. The underlying SECURITY DEFINER
 * function is service-role only, so the lookup happens here after the bearer
 * token has been verified rather than through a client-callable RPC.
 */
export const getMyEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EffectiveEntitlement> => {
    const { effectiveEntitlement } = await import("@/lib/entitlement");
    return effectiveEntitlement(context.userId);
  });
