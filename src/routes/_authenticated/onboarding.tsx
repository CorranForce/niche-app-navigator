import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { completeOnboarding, getOnboardingProfile } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search["next"] === "string" ? { next: search["next"] } : {},
  head: () => ({
    meta: [
      { title: "Set up your workspace — MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "Tell us your name, workspace, and what you're researching so your micro-SaaS reports are tailored to you.",
      },
      { property: "og:title", content: "Set up your workspace — MicroSaaS Solution Finder" },
      { property: "og:description", content: "Finish setting up your free account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnboardingPage,
});

function safePath(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/reports";
}

function OnboardingPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/onboarding" });
  const next = safePath(search.next);
  const load = useServerFn(getOnboardingProfile);
  const save = useServerFn(completeOnboarding);

  const { data, isLoading } = useQuery({ queryKey: ["onboarding-profile"], queryFn: () => load() });

  const [displayName, setDisplayName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [useCase, setUseCase] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDisplayName((v) => v || data.displayName);
    setWorkspaceName((v) => v || data.workspaceName);
    setRoleTitle((v) => v || data.roleTitle);
    setUseCase((v) => v || data.useCase);
  }, [data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: { displayName, workspaceName, roleTitle, useCase } });
      toast.success("Workspace ready");
      void navigate({ to: next, replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save your details");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-canvas min-h-screen px-4 py-16">
      <div className="mx-auto w-full max-w-lg">
        <p className="label-mono text-primary">Step 1 of 1</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Set up your workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your 7-day free trial is running. A few details so your reports read like they were
          written for you.
        </p>

        <Card className="mt-8 space-y-4 p-6">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="label-mono text-muted-foreground" htmlFor="displayName">
                  Your name
                </label>
                <Input
                  id="displayName"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Allen Davis"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-mono text-muted-foreground" htmlFor="workspaceName">
                  Workspace name
                </label>
                <Input
                  id="workspaceName"
                  required
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder="Freedom Ops Research"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-mono text-muted-foreground" htmlFor="roleTitle">
                  Your role <span className="opacity-60">(optional)</span>
                </label>
                <Input
                  id="roleTitle"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="Indie founder"
                />
              </div>
              <div className="space-y-1.5">
                <label className="label-mono text-muted-foreground" htmlFor="useCase">
                  What are you researching? <span className="opacity-60">(optional)</span>
                </label>
                <Input
                  id="useCase"
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  placeholder="B2B service niches I can automate"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finish setup"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
