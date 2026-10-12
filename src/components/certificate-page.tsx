import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function CertificatePage({ children }: { children: ReactNode }) {
  return (
    <div className="certificate-page">
      <div className="certificate-actions no-print">
        <Link to="/form" className="dashboard-action">
          ড্যাশবোর্ড
        </Link>
        <button type="button" className="print-action" onClick={() => window.print()}>
          প্রিন্ট করুন A4 সাইজ portrait ব্যবহার করুন।ভালপ্রিন্ট পেতে গুগল কোরাম ব্রাউজার ব্যবহার
          করুন
        </button>
      </div>
      <div className="certificate-scroll">{children}</div>
    </div>
  );
}
