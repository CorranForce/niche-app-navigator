import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TeamMemberRow = {
  id: string;
  invited_email: string;
  role: string;
  joined_at: string | null;
  user_id: string | null;
};

export type TeamState = {
  enabled: boolean;
  teamId: string | null;
  name: string | null;
  isOwner: boolean;
  seats: number;
  seatsUsed: number;
  members: TeamMemberRow[];
};

async function planFor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const { entitledPlan } = await import("@/lib/plan-limits");
  const paymentsEnv = import.meta.env.PROD ? "live" : "sandbox";
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status, product_id, current_period_end")
    .eq("user_id", userId)
    .eq("environment", paymentsEnv)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return entitledPlan(sub);
}

/** Studio workspace state: seats, members and whether the caller owns it. */
export const getTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeamState> => {
    const { planFeatures, STUDIO_SEATS } = await import("@/lib/plan-limits");
    const { ensureTeamForOwner, teamIdsForUser } = await import("@/lib/teams.server");
    const plan = await planFor(context.supabase, context.userId);
    const features = planFeatures(plan);

    let teamId: string | null = null;
    let isOwner = false;

    if (features.team) {
      teamId = await ensureTeamForOwner(context.supabase, context.userId);
      isOwner = Boolean(teamId);
    } else {
      const ids = await teamIdsForUser(context.supabase, context.userId);
      teamId = ids[0] ?? null;
    }

    if (!teamId) {
      return {
        enabled: features.team,
        teamId: null,
        name: null,
        isOwner: false,
        seats: STUDIO_SEATS,
        seatsUsed: 0,
        members: [],
      };
    }

    const [{ data: team }, { data: members }] = await Promise.all([
      context.supabase.from("teams").select("id, name, owner_id").eq("id", teamId).maybeSingle(),
      context.supabase
        .from("team_members")
        .select("id, invited_email, role, joined_at, user_id")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true }),
    ]);

    const list = (members ?? []) as TeamMemberRow[];
    return {
      enabled: features.team || list.length > 0,
      teamId,
      name: (team?.name as string) ?? "My studio",
      isOwner: isOwner || team?.owner_id === context.userId,
      seats: STUDIO_SEATS,
      seatsUsed: list.length + 1,
      members: list,
    };
  });

/** Invite a teammate by email (Studio only, seat-capped). */
export const inviteTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const { planFeatures, STUDIO_SEATS } = await import("@/lib/plan-limits");
    const { ensureTeamForOwner } = await import("@/lib/teams.server");
    const plan = await planFor(context.supabase, context.userId);
    if (!planFeatures(plan).team) {
      throw new Error("Team seats are part of the Studio plan. Upgrade to invite teammates.");
    }
    const teamId = await ensureTeamForOwner(context.supabase, context.userId);
    if (!teamId) throw new Error("Could not open your workspace.");

    const { count } = await context.supabase
      .from("team_members")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId);
    if ((count ?? 0) + 1 >= STUDIO_SEATS) {
      throw new Error(`Your Studio plan includes ${STUDIO_SEATS} seats and they're all in use.`);
    }

    const { error } = await context.supabase
      .from("team_members")
      .insert({ team_id: teamId, invited_email: data.email.toLowerCase() });
    if (error) {
      throw new Error(
        error.code === "23505" ? "That email is already on your team." : error.message,
      );
    }
    return { ok: true };
  });

/** Remove a teammate (owner only). */
export const removeTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("team_members").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Attach any pending invitations that match the signed-in user's email. */
export const claimInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = context.claims as { email?: string } | undefined;
    const email = typeof claims?.email === "string" ? claims.email : "";
    if (!email) return { claimed: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("claim_team_invites", {
      _user_id: context.userId,
      _email: email,
    });
    if (error) return { claimed: 0 };
    return { claimed: (data as number) ?? 0 };
  });
