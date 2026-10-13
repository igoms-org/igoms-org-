import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useLayoutEffect, useRef } from "react";
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
  const viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const frame = viewport.current;
    const certificate = frame?.querySelector<HTMLElement>(".cer-container");
    const scroll = frame?.querySelector<HTMLElement>(".certificate-scroll");
    if (!frame || !certificate || !scroll) return;
    const fit = () => {
      const paper = getComputedStyle(certificate);
      const desk = getComputedStyle(scroll);
      const borders = parseFloat(paper.borderLeftWidth) + parseFloat(paper.borderRightWidth);
      const boxWidth = parseFloat(paper.width) + parseFloat(paper.paddingLeft) +
        parseFloat(paper.paddingRight) + borders;
      const paintedWidth = boxWidth + borders * parseFloat(paper.borderImageOutset);
      const pageWidth = Math.max(paintedWidth, boxWidth + parseFloat(desk.paddingLeft) + parseFloat(desk.paddingRight));
      if (pageWidth > 0 && frame.clientWidth > 0) {
        frame.style.setProperty("--certificate-mobile-width", `${pageWidth}px`);
        frame.style.setProperty("--certificate-mobile-zoom", String(Math.min(0.95, frame.clientWidth / pageWidth)));
      }
    };
    fit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(frame);
    window.addEventListener("resize", fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [data]);
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
    <div className="verification-viewport" ref={viewport}>
      <CertificatePage>
        <CertificateDocument data={toDocument(data.form, data.certificateNo)} verificationUrl={url} />
      </CertificatePage>
    </div>
  );
}
