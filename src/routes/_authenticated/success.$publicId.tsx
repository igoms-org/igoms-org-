import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useVerificationUrl } from "@/hooks/use-verification-url";
import { CertificateDocument } from "@/components/certificate-document";
import { CertificatePage } from "@/components/certificate-page";
import { verifyCertificate } from "@/lib/certificates.functions";
import { toDocument } from "@/lib/family";

export const Route = createFileRoute("/_authenticated/success/$publicId")({
  head: () => ({
    meta: [
      { title: "সনদ তৈরি হয়েছে" },
      { name: "description", content: "আপনার পারিবারিক সনদ তৈরি হয়েছে।" },
      { property: "og:title", content: "সনদ তৈরি হয়েছে" },
      { property: "og:description", content: "শেয়ারযোগ্য লিংক ও QR কোডসহ সনদ।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { publicId } = Route.useParams();
  const get = useServerFn(verifyCertificate);
  const cert = useQuery({
    queryKey: ["verify", publicId],
    queryFn: () => get({ data: { publicId } }),
  });
  const link = useVerificationUrl(publicId);
  return (
    <CertificatePage>
      {cert.data ? (
        <CertificateDocument
          data={toDocument(cert.data.form, cert.data.certificateNo)}
          verificationUrl={link}
        />
      ) : (
        <p className="certificate-status">{cert.isError ? "সনদ লোড করা যায়নি" : "লোড হচ্ছে…"}</p>
      )}
    </CertificatePage>
  );
}
