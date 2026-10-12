import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppHeader } from "@/components/app-header";
import { myCertificates } from "@/lib/certificates.functions";

export const Route = createFileRoute("/_authenticated/my-certificates")({
  head: () => ({ meta: [{ title: "আমার সনদ" }, { name: "description", content: "আপনার তৈরি করা পারিবারিক সনদের তালিকা।" }, { property: "og:title", content: "আমার সনদ" }, { property: "og:description", content: "তৈরি করা পারিবারিক সনদের তালিকা।" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: MyCertificates,
});

function MyCertificates() {
  const fn = useServerFn(myCertificates);
  const q = useQuery({ queryKey: ["my-certificates"], queryFn: () => fn() });
  return (
    <div className="app-shell">
      <AppHeader />
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="mb-4 text-2xl font-bold text-primary">আমার সনদ</h1>
        {q.isPending ? <p>লোড হচ্ছে…</p> : q.isError ? <p role="alert" className="text-destructive">{q.error.message}</p> : q.data.length === 0 ? <p className="text-muted-foreground">এখনো কোনো সনদ তৈরি হয়নি।</p> :
          <div className="overflow-x-auto rounded-md border bg-card"><table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground"><tr><th className="p-2 text-left">সনদ নং</th><th className="p-2 text-left">আবেদনকারী</th><th className="p-2 text-left">তারিখ</th><th className="p-2 text-left">টোকেন</th><th className="p-2" /></tr></thead>
            <tbody>{q.data.map(c => <tr key={c.publicId} className="border-t"><td className="p-2">{c.certificateNo}</td><td className="p-2">{c.applicant}</td><td className="p-2">{new Date(c.createdAt).toLocaleDateString("en-GB")}</td><td className="p-2">{c.tokens}</td><td className="p-2 text-right"><Link className="text-primary underline" to="/verify/$publicId" params={{ publicId: c.publicId }}>দেখুন</Link></td></tr>)}</tbody>
          </table></div>}
      </main>
    </div>
  );
}
