import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useVerificationUrl } from "@/hooks/use-verification-url";
import { CertificatePage } from "@/components/certificate-page";
import { CertificateDocument } from "@/components/certificate-document";
import { verifyCertificate } from "@/lib/certificates.functions";
import { toDocument } from "@/lib/family";

const verifyQuery = (publicId: string) =>
  queryOptions({
    queryKey: ["verify", publicId],
    queryFn: () =>
      /^[A-Za-z0-9_-]{12}$/.test(publicId)
        ? verifyCertificate({ data: { publicId } })
        : Promise.resolve(null),
  });

export const Route = createFileRoute("/verify/$publicId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(verifyQuery(params.publicId)),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? "পারিবারিক সনদ" : "সনদ পাওয়া যায়নি" },
      { name: "description", content: "ইউনিয়ন পরিষদ পারিবারিক সনদ যাচাই।" },
      { property: "og:title", content: "পারিবারিক সনদ" },
      {
        property: "og:description",
        content: "QR কোডের মাধ্যমে পারিবারিক সনদের সত্যতা যাচাই করুন।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { publicId } = Route.useParams();
  const { data } = useSuspenseQuery(verifyQuery(publicId));
  const url = useVerificationUrl(publicId);
  if (!data)
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary">সনদ পাওয়া যায়নি</h1>
          <p className="text-muted-foreground">Certificate not found</p>
        </div>
      </main>
    );
  return (
    <CertificatePage>
      <CertificateDocument data={toDocument(data.form, data.certificateNo)} verificationUrl={url} />
    </CertificatePage>
  );
}
