import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "লগইন — পারিবারিক সনদ" }, { name: "description", content: "পারিবারিক সনদ ব্যবস্থায় লগইন করুন।" }, { property: "og:title", content: "লগইন — পারিবারিক সনদ" }, { property: "og:description", content: "ইউনিয়ন পরিষদ পারিবারিক সনদ ব্যবস্থা।" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4">
      <form className="w-full max-w-sm space-y-4 rounded-lg border-t-4 border-primary bg-card p-6 shadow" onSubmit={async e => {
        e.preventDefault(); setBusy(true); setError("");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        setBusy(false);
        if (error) { setError("ইমেইল বা পাসওয়ার্ড সঠিক নয়।"); return; }
        navigate({ to: "/form" });
      }}>
        <h1 className="text-center text-2xl font-bold text-primary">পারিবারিক সনদ</h1>
        <p className="text-center text-sm text-muted-foreground">ইউনিয়ন পরিষদ সনদ ব্যবস্থায় লগইন করুন</p>
        <div><Label htmlFor="email">ইমেইল</Label><Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="password">পাসওয়ার্ড</Label><Input id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "অপেক্ষা করুন…" : "লগইন"}</Button>
      </form>
    </main>
  );
}
