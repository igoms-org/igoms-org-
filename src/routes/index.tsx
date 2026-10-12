import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [{ title: "পারিবারিক সনদ — ইউনিয়ন পরিষদ" }, { name: "description", content: "ইউনিয়ন পরিষদ পারিবারিক সনদ তৈরি, যাচাই ও A4 মুদ্রণ।" }, { property: "og:title", content: "পারিবারিক সনদ — ইউনিয়ন পরিষদ" }, { property: "og:description", content: "পারিবারিক সনদ তৈরি, QR যাচাই ও A4 মুদ্রণ।" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/form" : "/auth" });
  },
  component: () => null,
});
