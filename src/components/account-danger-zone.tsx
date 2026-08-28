import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount, exportMyData } from "@/lib/account-data.functions";

/** Data export and permanent account deletion. */
export function AccountDangerZone() {
  const doExport = useServerFn(exportMyData);
  const doDelete = useServerFn(deleteMyAccount);
  const [busy, setBusy] = useState<"export" | "delete" | null>(null);
  const [confirm, setConfirm] = useState("");

  async function handleExport() {
    setBusy("export");
    try {
      const payload = await doExport({});
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `solutionfinder-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data export has downloaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    setBusy("delete");
    try {
      await doDelete({ data: { confirm: "DELETE" } });
      await supabase.auth.signOut();
      toast.success("Your account and data have been deleted.");
      window.location.href = "/";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the account.");
      setBusy(null);
    }
  }

  return (
    <section id="data" className="scroll-mt-24">
      <h2 className="text-xl font-semibold">Your data</h2>

      <Card className="mt-4 gap-4 border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">Export everything</p>
            <p className="text-sm text-muted-foreground">
              Download your profile, every report and your billing history as JSON.
            </p>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={busy !== null}>
            {busy === "export" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export data
          </Button>
        </div>
      </Card>

      <Card className="mt-4 gap-4 border-destructive/40 bg-destructive/5 p-6">
        <div>
          <p className="font-medium">Delete account</p>
          <p className="text-sm text-muted-foreground">
            This cancels any active subscription immediately and permanently removes your reports,
            workspace and sign-in methods. It cannot be undone — export first if you want a copy.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="max-w-56"
            aria-label="Type DELETE to confirm account deletion"
          />
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirm !== "DELETE" || busy !== null}
          >
            {busy === "delete" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete my account
          </Button>
        </div>
      </Card>
    </section>
  );
}
