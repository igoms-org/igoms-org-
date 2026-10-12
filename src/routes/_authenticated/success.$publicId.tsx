import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CertificateDocument } from "@/components/certificate-document";
import { verifyCertificate } from "@/lib/certificates.functions";
import { toDocument } from "@/lib/family";

export const Route = createFileRoute("/_authenticated/success/$publicId")({
  head: () => ({ meta: [{ title: "সনদ তৈরি হয়েছে" }, { name: "description", content: "আপনার পারিবারিক সনদ তৈরি হয়েছে।" }, { property: "og:title", content: "সনদ তৈরি হয়েছে" }, { property: "og:description", content: "শেয়ারযোগ্য লিংক ও QR কোডসহ সনদ।" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: SuccessPage,
});

function SuccessPage() {
  const { publicId } = Route.useParams();
  const get = useServerFn(verifyCertificate);
  const cert = useQuery({ queryKey: ["verify", publicId], queryFn: () => get({ data: { publicId } }) });
  const [link, setLink] = useState("");
  useEffect(() => setLink(`${window.location.origin}/verify/${publicId}`), [publicId]);
  return (
    <div className="certificate-page">
      <div className="certificate-actions">
        <Link to="/form" className="dashboard-action">ড্যাশবোর্ড</Link>
        <button type="button" className="print-action" onClick={() => window.print()}>
          প্রিন্ট করুন A4 সাইজ portrait ব্যবহার করুন।ভালপ্রিন্ট পেতে গুগল কোরাম ব্রাউজার ব্যবহার করুন
        </button>
      </div>
      <div className="certificate-scroll">
        {cert.data ? (
          <CertificateDocument data={toDocument(cert.data.form, cert.data.certificateNo)} verificationUrl={link || publicId} />
        ) : (
          <p className="certificate-status">{cert.isError ? "সনদ লোড করা যায়নি" : "লোড হচ্ছে…"}</p>
        )}
      </div>
    </div>
  );
}
