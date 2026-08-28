import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EnsureAccountStatus =
  | "created" // brand-new account provisioned
  | "existing" // account already existed for this user
  | "linked" // this Google identity attached to an account that already had this email
  | "missing_email" // provider returned no email address
  | "duplicate_email" // another account already owns this email
  | "error";

export type EnsureAccountResult = {
  status: EnsureAccountStatus;
  created: boolean;
  needsOnboarding: boolean;
  plan: import("@/lib/plan-limits").PlanId;
  message?: string;
};

/**
 * Called right after a sign-in (Google or email). Looks the signed-in user's
 * account up by id and by email, links the identity to an existing account when
 * the email already exists, and otherwise provisions a new account.
 * Idempotent and race-safe — safe to call on every sign-in, concurrently.
 */
export const ensureAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EnsureAccountResult> => {
    const { entitledPlan } = await import("@/lib/plan-limits");
    const { supabase, userId, claims } = context;

    const paymentsEnv = import.meta.env.PROD ? "live" : "sandbox";
    const planFor = async () => {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, product_id, current_period_end")
        .eq("user_id", userId)
        .eq("environment", paymentsEnv)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return entitledPlan(sub);
    };

    const c = claims as { email?: string; user_metadata?: Record<string, unknown> } | undefined;
    const rawEmail = typeof c?.email === "string" ? c.email.trim() : "";
    const email = rawEmail ? rawEmail.toLowerCase() : "";
    const meta = c?.user_metadata;
    const displayName =
      (typeof meta?.["full_name"] === "string" ? (meta["full_name"] as string) : undefined) ??
      (typeof meta?.["name"] === "string" ? (meta["name"] as string) : undefined) ??
      (email ? (email.split("@")[0] ?? null) : null);

    // Existing account for this exact user?
    const { data: existing, error: readError } = await supabase
      .from("profiles")
      .select("id, email, onboarded_at")
      .eq("id", userId)
      .maybeSingle();
    if (readError) {
      return {
        status: "error",
        created: false,
        needsOnboarding: false,
        plan: await planFor(),
        message: readError.message,
      };
    }

    if (existing) {
      // Backfill the email once we know it (older rows predate the column).
      if (email && !existing.email) {
        await supabase.from("profiles").update({ email }).eq("id", userId);
      }
      return {
        status: "existing",
        created: false,
        needsOnboarding: !existing.onboarded_at,
        plan: await planFor(),
      };
    }

    // Google (or any provider) can return a session without an email address —
    // e.g. a Workspace account with the email scope declined.
    if (!email) {
      return {
        status: "missing_email",
        created: false,
        needsOnboarding: true,
        plan: await planFor(),
        message:
          "Your Google account didn't share an email address. Grant email access and sign in again, or use email and password.",
      };
    }

    // Does another account already own this email? Needs admin: RLS hides other
    // users' profiles, which would otherwise look like "no account exists".
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: byEmail } = await supabaseAdmin
      .from("profiles")
      .select("id, onboarded_at")
      .ilike("email", email)
      .maybeSingle();

    if (byEmail && byEmail.id !== userId) {
      // Supabase links same-email identities onto one auth user when the email
      // is verified, so this means a genuinely separate legacy account exists.
      return {
        status: "duplicate_email",
        created: false,
        needsOnboarding: false,
        plan: await planFor(),
        message:
          "An account already exists for this email. Sign in with your original method, then link Google from the Account page.",
      };
    }

    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: userId, email, display_name: displayName });

    if (insertError) {
      // 23505: a concurrent sign-in won the race, or the email unique index hit.
      if (insertError.code === "23505") {
        const { data: after } = await supabase
          .from("profiles")
          .select("id, onboarded_at")
          .eq("id", userId)
          .maybeSingle();
        if (after) {
          return {
            status: "linked",
            created: false,
            needsOnboarding: !after.onboarded_at,
            plan: await planFor(),
          };
        }
        return {
          status: "duplicate_email",
          created: false,
          needsOnboarding: false,
          plan: await planFor(),
          message:
            "An account already exists for this email. Sign in with your original method, then link Google from the Account page.",
        };
      }
      return {
        status: "error",
        created: false,
        needsOnboarding: false,
        plan: await planFor(),
        message: insertError.message,
      };
    }

    return { status: "created", created: true, needsOnboarding: true, plan: await planFor() };
  });

export type OnboardingProfile = {
  displayName: string;
  workspaceName: string;
  roleTitle: string;
  useCase: string;
  onboarded: boolean;
};

export const getOnboardingProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingProfile> => {
    const { data } = await context.supabase
      .from("profiles")
      .select("display_name, workspace_name, role_title, use_case, onboarded_at")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      displayName: data?.display_name ?? "",
      workspaceName: data?.workspace_name ?? "",
      roleTitle: data?.role_title ?? "",
      useCase: data?.use_case ?? "",
      onboarded: Boolean(data?.onboarded_at),
    };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      displayName: string;
      workspaceName: string;
      roleTitle?: string;
      useCase?: string;
    }) => {
      const displayName = input.displayName?.trim() ?? "";
      const workspaceName = input.workspaceName?.trim() ?? "";
      if (displayName.length < 2) throw new Error("Please enter your name.");
      if (workspaceName.length < 2) throw new Error("Please enter a workspace name.");
      return {
        displayName: displayName.slice(0, 80),
        workspaceName: workspaceName.slice(0, 80),
        roleTitle: (input.roleTitle ?? "").trim().slice(0, 80),
        useCase: (input.useCase ?? "").trim().slice(0, 200),
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        display_name: data.displayName,
        workspace_name: data.workspaceName,
        role_title: data.roleTitle || null,
        use_case: data.useCase || null,
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
