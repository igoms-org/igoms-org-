import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/app-header";
import { adminAdjustTokens, adminOverview, adminSetCost, adminSetNextNo } from "@/lib/certificates.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "অ্যাডমিন প্যানেল — পারিবারিক সনদ" }, { name: "description", content: "ব্যবহারকারী, টোকেন ও সনদ ব্যবস্থাপনা।" }, { property: "og:title", content: "অ্যাডমিন প্যানেল" }, { property: "og:description", content: "টোকেন ও সনদ ব্যবস্থাপনা।" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AdminPage,
});

const fmt = (d: string | null) => d ? new Date(d).toLocaleString("en-GB") : "-";

function AdminPage() {
  const fn = useServerFn(adminOverview);
  const q = useQuery({ queryKey: ["admin"], queryFn: () => fn(), retry: false });
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [txFilter, setTxFilter] = useState("");
  const [txType, setTxType] = useState("");
  const names = useMemo(() => new Map((q.data?.users ?? []).map(u => [u.user_id, u.full_name || u.email])), [q.data]);
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["admin"] }), qc.invalidateQueries({ queryKey: ["me"] })]);
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="mx-auto max-w-7xl p-4">
        <h1 className="mb-4 text-2xl font-bold text-primary">অ্যাডমিন প্যানেল</h1>
        {q.isPending ? <p>লোড হচ্ছে…</p> : q.isError ? <p role="alert" className="text-destructive">শুধুমাত্র অ্যাডমিনদের জন্য।</p> : (
          <Tabs defaultValue="users">
            <TabsList className="flex-wrap"><TabsTrigger value="users">ব্যবহারকারী</TabsTrigger><TabsTrigger value="cost">সনদের খরচ</TabsTrigger><TabsTrigger value="certs">সকল সনদ</TabsTrigger><TabsTrigger value="tx">টোকেন ইতিহাস</TabsTrigger></TabsList>
            <TabsContent value="users" className="space-y-3">
              <Input placeholder="নাম বা ইমেইল খুঁজুন" value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
              {q.data.users.filter(u => `${u.full_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())).map(u => (
                <div key={u.user_id} className="rounded-md border bg-card p-3">
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm"><b>{u.full_name || "-"}</b><span>{u.email}</span><span>টোকেন: <b>{u.token_balance}</b></span><span>ভূমিকা: {u.role}</span><span>সনদ: {u.certificate_count}</span><span>শেষ সনদ: {fmt(u.last_certificate_at)}</span></div>
                  <TokenControls userId={u.user_id} onDone={refresh} />
                </div>))}
            </TabsContent>
            <TabsContent value="cost" className="space-y-3"><CostEditor current={q.data.cost} onDone={refresh} /><NextNoEditor onDone={refresh} /></TabsContent>
            <TabsContent value="certs">
              <Table head={["সনদ নং", "আবেদনকারী", "তৈরিকারী", "তারিখ", "টোকেন", ""]} rows={q.data.certificates.map(c => [c.certificateNo, c.applicant, names.get(c.ownerId ?? "") ?? "-", fmt(c.createdAt), String(c.tokens), <Link key="l" className="text-primary underline" to="/verify/$publicId" params={{ publicId: c.publicId }}>দেখুন</Link>])} />
            </TabsContent>
            <TabsContent value="tx" className="space-y-3">
              <div className="flex flex-wrap gap-2"><Input className="max-w-xs" placeholder="ব্যবহারকারী বা নোট" value={txFilter} onChange={e => setTxFilter(e.target.value)} />
                <select className="h-9 rounded-md border border-input bg-background px-2" value={txType} onChange={e => setTxType(e.target.value)}><option value="">সব ধরন</option><option value="admin_adjust">admin_adjust</option><option value="certificate">certificate</option></select></div>
              <Table head={["সময়", "ব্যবহারকারী", "পরিমাণ", "ধরন", "নোট", "করেছেন"]} rows={q.data.transactions.filter(t => (!txType || t.type === txType) && `${names.get(t.user_id) ?? ""} ${t.note}`.toLowerCase().includes(txFilter.toLowerCase())).map(t => [fmt(t.created_at), names.get(t.user_id) ?? t.user_id, (t.amount > 0 ? "+" : "") + t.amount, t.type, t.note, names.get(t.created_by ?? "") ?? "-"])} />
            </TabsContent>
          </Tabs>)}
      </main>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return <div className="overflow-x-auto rounded-md border bg-card"><table className="w-full text-sm"><thead className="bg-primary text-primary-foreground"><tr>{head.map((h, i) => <th key={i} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td className="p-3 text-muted-foreground" colSpan={head.length}>কিছু নেই</td></tr> : rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="p-2">{c}</td>)}</tr>)}</tbody></table></div>;
}

function TokenControls({ userId, onDone }: { userId: string; onDone: () => Promise<unknown> }) {
  const adjust = useServerFn(adminAdjustTokens);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const run = async (mode: "add" | "remove" | "set") => {
    const n = Number(amount);
    if (!Number.isInteger(n) || n < 0) { setMsg("সঠিক পরিমাণ দিন"); return; }
    try { const r = await adjust({ data: { userId, mode, amount: n, note } }); setMsg(`নতুন ব্যালান্স: ${r.balance}`); setAmount(""); setNote(""); await onDone(); }
    catch (e) { setMsg(e instanceof Error ? e.message : "ব্যর্থ"); }
  };
  return <div className="mt-2 flex flex-wrap items-end gap-2">
    <div><Label className="text-xs">পরিমাণ</Label><Input className="w-28" type="number" min={0} value={amount} onChange={e => setAmount(e.target.value)} /></div>
    <div className="flex-1"><Label className="text-xs">নোট</Label><Input value={note} maxLength={300} onChange={e => setNote(e.target.value)} /></div>
    <Button size="sm" onClick={() => run("add")}>টোকেন যোগ</Button><Button size="sm" variant="outline" onClick={() => run("remove")}>টোকেন কমান</Button><Button size="sm" variant="secondary" onClick={() => run("set")}>নির্দিষ্ট ব্যালান্স</Button>
    {msg && <span className="text-sm">{msg}</span>}
  </div>;
}

function CostEditor({ current, onDone }: { current: number; onDone: () => Promise<unknown> }) {
  const save = useServerFn(adminSetCost);
  const [v, setV] = useState(String(current));
  const [msg, setMsg] = useState("");
  useEffect(() => setV(String(current)), [current]);
  return <div className="flex max-w-sm items-end gap-2 rounded-md border bg-card p-4">
    <div className="flex-1"><Label htmlFor="cost">প্রতি সনদের খরচ (টোকেন)</Label><Input id="cost" type="number" min={0} value={v} onChange={e => setV(e.target.value)} /></div>
    <Button onClick={async () => { const n = Number(v); if (!Number.isInteger(n) || n < 0) { setMsg("সঠিক সংখ্যা দিন"); return; } try { await save({ data: { cost: n } }); setMsg("সংরক্ষিত"); await onDone(); } catch (e) { setMsg(e instanceof Error ? e.message : "ব্যর্থ"); } }}>সংরক্ষণ</Button>
    {msg && <span className="text-sm">{msg}</span>}
  </div>;
}

function NextNoEditor({ onDone }: { onDone: () => Promise<unknown> }) {
  const save = useServerFn(adminSetNextNo);
  const [v, setV] = useState("");
  const [msg, setMsg] = useState("");
  return <div className="flex max-w-sm items-end gap-2 rounded-md border bg-card p-4">
    <div className="flex-1"><Label htmlFor="nextno">পরবর্তী সনদের শুরু নম্বর</Label><Input id="nextno" type="number" min={1} placeholder="যেমন: 1687" value={v} onChange={e => setV(e.target.value)} /></div>
    <Button onClick={async () => { const n = Number(v); if (!Number.isInteger(n) || n < 1) { setMsg("সঠিক সংখ্যা দিন"); return; } try { const r = await save({ data: { next: n } }); setMsg(`পরবর্তী নম্বর: ${r.nextNo}`); await onDone(); } catch (e) { setMsg(e instanceof Error ? e.message : "ব্যর্থ"); } }}>সংরক্ষণ</Button>
    {msg && <span className="text-sm">{msg}</span>}
  </div>;
}
