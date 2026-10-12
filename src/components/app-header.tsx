import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/certificates.functions";

export function useMe() {
  const fn = useServerFn(getMe);
  return useQuery({ queryKey: ["me"], queryFn: () => fn() });
}

export function AppHeader() {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const linkCls = "rounded px-3 py-1.5 text-sm hover:bg-primary-foreground/15";
  return (
    <header className="app-header no-print">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
        <span className="mr-4 text-lg font-bold">পারিবারিক সনদ</span>
        <nav className="flex flex-wrap gap-1">
          <Link to="/form" className={linkCls} activeProps={{ className: "bg-primary-foreground/20" }}>নতুন সনদ</Link>
          <Link to="/my-certificates" className={linkCls} activeProps={{ className: "bg-primary-foreground/20" }}>আমার সনদ</Link>
          {me.data?.isAdmin && <Link to="/admin" className={linkCls} activeProps={{ className: "bg-primary-foreground/20" }}>অ্যাডমিন</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {me.data && <span>টোকেন: <b>{me.data.profile?.token_balance ?? 0}</b></span>}
          <Button size="sm" variant="secondary" onClick={async () => {
            await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true });
          }}><LogOut />লগ আউট</Button>
        </div>
      </div>
    </header>
  );
}
