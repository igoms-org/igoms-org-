import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BadgeCheck, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CertificateDocument } from "@/components/certificate-document";
import { verifyCertificate } from "@/lib/certificates.functions";
import { toDocument } from "@/lib/family";

const verifyQuery = (publicId: string) => queryOptions({
  queryKey: ["verify", publicId],
  queryFn: () => /^[A-Za-z0-9_-]{12}$/.test(publicId) ? verifyCertificate({ data: { publicId } }) : Promise.resolve(null),
});

export const Route = createFileRoute("/verify/$publicId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(verifyQuery(params.publicId)),
  head: ({ loaderData }) => ({ meta: [
    { title: loaderData ? `সনদ যাচাই — ${loaderData.certificateNo}` : "সনদ পাওয়া যায়নি" },
    { name: "description", content: "ইউনিয়ন পরিষদ পারিবারিক সনদ যাচাই।" },
    { property: "og:title", content: "পারিবারিক সনদ যাচাই" },
    { property: "og:description", content: "QR কোডের মাধ্যমে পারিবারিক সনদের সত্যতা যাচাই করুন।" },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
  ] }),
  component: VerifyPage,
});

function VerifyPage() {
  const { publicId } = Route.useParams();
  const { data } = useSuspenseQuery(verifyQuery(publicId));
  if (!data) return <main className="flex min-h-screen items-center justify-center p-6"><div className="text-center"><h1 className="text-2xl font-bold text-primary">সনদ পাওয়া যায়নি</h1><p className="text-muted-foreground">Certificate not found</p></div></main>;
  const [url, setUrl] = useState("");
  useEffect(() => setUrl(window.location.href), []);
  return (
    <main className="app-shell py-4">
      <div className="no-print mx-auto mb-2 flex max-w-3xl flex-wrap items-center justify-center gap-3 px-4">
        <span className="verified-badge inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-semibold"><BadgeCheck size={18} />যাচাইকৃত সনদ · Verified</span>
        <Button variant="outline" onClick={() => window.print()}><Printer />প্রিন্ট / PDF</Button>
      </div>
      <div className="preview-box mx-auto max-w-[720px]"><CertificateDocument data={toDocument(data.form, data.certificateNo)} verificationUrl={url || data.publicId} /></div>
    </main>
  );
}
