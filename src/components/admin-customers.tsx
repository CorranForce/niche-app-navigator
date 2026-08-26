import { Fragment, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchBillingUsers, getUserBillingHistory } from "@/lib/admin-billing.functions";

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtAmount(amount: string | null, currency: string | null) {
  if (!amount) return "—";
  const value = Number(amount) / 100;
  if (Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency ?? "USD",
  }).format(value);
}

function statusTone(status: string | null) {
  if (status === "past_due") return "text-destructive";
  if (status === "active" || status === "trialing") return "text-primary";
  return "text-muted-foreground";
}

function BillingHistory({ userId }: { userId: string }) {
  const fetchHistory = useServerFn(getUserBillingHistory);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-billing-history", userId],
    queryFn: () => fetchHistory({ data: { userId } }),
    retry: false,
  });

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading billing history…
      </p>
    );
  }
  if (error) {
    return <p className="px-4 py-3 text-xs text-destructive">{(error as Error).message}</p>;
  }
  if (!data?.length) {
    return <p className="px-4 py-3 text-xs text-muted-foreground">No transactions yet.</p>;
  }

  return (
    <table className="w-full text-left text-xs">
      <thead className="label-mono text-muted-foreground">
        <tr>
          <th className="px-4 py-2 font-normal">Invoice</th>
          <th className="px-4 py-2 font-normal">Date</th>
          <th className="px-4 py-2 font-normal">Status</th>
          <th className="px-4 py-2 text-right font-normal">Amount</th>
        </tr>
      </thead>
      <tbody className="font-mono">
        {data.map((row) => (
          <tr key={row.id} className="border-t border-border/60">
            <td className="px-4 py-2">{row.invoiceNumber ?? row.id}</td>
            <td className="px-4 py-2">{fmtDate(row.billedAt)}</td>
            <td className="px-4 py-2">{row.status}</td>
            <td className="px-4 py-2 text-right">{fmtAmount(row.amount, row.currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AdminCustomersSection() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [openUser, setOpenUser] = useState<string | null>(null);
  const search = useServerFn(searchBillingUsers);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users", query],
    queryFn: () => search({ data: { query } }),
    retry: false,
  });

  return (
    <section id="customers" className="mt-10 scroll-mt-24">
      <h2 className="text-lg font-semibold tracking-tight">Customer billing</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Search a customer to see their plan, subscription status, renewal date and invoices.
      </p>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by email or user ID"
          className="max-w-md"
        />
        <Button type="submit">
          <Search className="h-4 w-4" /> Search
        </Button>
      </form>

      {error ? (
        <Card className="mt-6 flex items-center gap-2 border-destructive/40 bg-destructive/10 p-4 text-sm">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          {(error as Error).message}
        </Card>
      ) : null}

      <Card className="mt-6 gap-0 overflow-hidden border-border bg-surface p-0">
        {isLoading ? (
          <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
          </p>
        ) : !data?.length ? (
          <p className="p-4 text-sm text-muted-foreground">No matching customers.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="label-mono border-b border-border text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-normal">Customer</th>
                <th className="px-4 py-3 font-normal">Plan</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 font-normal">Renews</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <Fragment key={u.userId}>
                  <tr className="border-t border-border/60">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{u.email ?? u.userId}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        joined {fmtDate(u.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{u.plan}</td>
                    <td className={`px-4 py-3 font-mono text-xs ${statusTone(u.status)}`}>
                      {u.status ?? "no subscription"}
                      {u.cancelAtPeriodEnd ? " (cancels)" : ""}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{fmtDate(u.currentPeriodEnd)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpenUser(openUser === u.userId ? null : u.userId)}
                      >
                        {openUser === u.userId ? "Hide invoices" : "Invoices"}
                      </Button>
                    </td>
                  </tr>
                  {openUser === u.userId ? (
                    <tr className="border-t border-border/60 bg-background/40">
                      <td colSpan={5} className="p-0">
                        <BillingHistory userId={u.userId} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  );
}
