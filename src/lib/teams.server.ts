import type { SupabaseClient } from "@supabase/supabase-js";

/** Returns (creating if needed) the Studio workspace owned by this user. */
export async function ensureTeamForOwner(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("owner_id", userId)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from("teams")
    .insert({ owner_id: userId })
    .select("id")
    .maybeSingle();
  if (error || !created) return null;
  return created.id as string;
}

/** All workspace ids the user can read reports from (owned + joined). */
export async function teamIdsForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<string[]> {
  const [owned, joined] = await Promise.all([
    supabase.from("teams").select("id").eq("owner_id", userId),
    supabase.from("team_members").select("team_id").eq("user_id", userId),
  ]);
  const ids = new Set<string>();
  for (const row of owned.data ?? []) ids.add(row.id as string);
  for (const row of joined.data ?? []) ids.add(row.team_id as string);
  return [...ids];
}
