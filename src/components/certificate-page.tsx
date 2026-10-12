import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

export function CertificatePage({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else void navigate({ to: "/", replace: true });
  };
  return (
    <div className="certificate-page">
      <div className="certificate-actions no-print">
        <button type="button" className="dashboard-action" onClick={goBack}>
          ড্যাশবোর্ড
        </button>
        <button type="button" className="print-action" onClick={() => window.print()}>
          প্রিন্ট করুন A4 সাইজ portrait ব্যবহার করুন।ভালপ্রিন্ট পেতে গুগল কোরাম ব্রাউজার ব্যবহার
          করুন
        </button>
      </div>
      <div className="certificate-scroll">{children}</div>
    </div>
  );
}
