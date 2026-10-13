import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { FamilyForm } from "@/lib/family";

const state = vi.hoisted(() => ({
  navigate: vi.fn(),
  publicId: "AAAAAAAAAAAA",
  data: null as { publicId: string; certificateNo: string; form: FamilyForm } | null,
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => state.navigate,
  Link: ({ to, className, children }: { to: string; className?: string; children: ReactNode }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  createFileRoute: () => (options: object) => ({
    options,
    useParams: () => ({ publicId: state.publicId }),
  }),
}));
vi.mock("@tanstack/react-query", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    queryOptions: (options: object) => options,
    useQuery: () => ({ data: state.data, isError: false }),
    useSuspenseQuery: () => {
      // Keep a real hook before the page's hooks, as React Query does.
      React.useState(0);
      return { data: state.data };
    },
  };
});
vi.mock("@/lib/certificates.functions", () => ({ verifyCertificate: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => <span data-testid="qr">{value}</span>,
}));

import { Route } from "@/routes/verify.$publicId";
import { Route as SuccessRoute } from "@/routes/_authenticated/success.$publicId";
import { CertificateDocument } from "@/components/certificate-document";
import { familyFormSchema, toDocument } from "@/lib/family";
const Page = Route.options.component as React.ComponentType;
const SuccessPage = SuccessRoute.options.component as React.ComponentType;
const form: FamilyForm = {
  issueDate: "2026-07-25",
  applicantName: "Applicant",
  applicantReg: "",
  father: "Father",
  mother: "Mother",
  village: "Village",
  wardNo: "4",
  house: "1",
  remarks: "-",
  union: "Union",
  upazila: "Upazila",
  district: "District",
  ward: "7",
  signer: "Signer",
  members: [{ name: "Applicant", reg: "", dob: "2000-01-01", relation: "নিজ" }],
};
function setCertificate(publicId: string) {
  state.publicId = publicId;
  state.data = { publicId, certificateNo: "00000001", form };
  window.history.replaceState(null, "", `/verify/${publicId}?tracking=test`);
}

it("shows the saved QR ID separately from the certificate number while keeping the scan URL", () => {
  setCertificate("AAAAAAAAAAAA");
  state.data = { ...state.data!, certificateNo: "00000023", form: { ...form, qrId: 2156 } };
  const publicView = render(<Page />);
  const successView = render(<SuccessPage />);
  const preview = render(<CertificateDocument data={toDocument({ ...form, qrId: 2156 }, "00000023")}
    verificationUrl={`${window.location.origin}/verify/AAAAAAAAAAAA`} />);
  for (const view of [publicView, successView, preview]) {
    expect(view.container.querySelector(".qrframe")).toHaveTextContent("2156");
    expect(view.container.querySelector(".certificate-number")).toHaveTextContent("00000023");
    expect(within(view.container).getByTestId("qr")).toHaveTextContent(`${window.location.origin}/verify/AAAAAAAAAAAA`);
  }
  expect(publicView.container.querySelector(".certificate-page")!.outerHTML).toBe(successView.container.innerHTML);
  expect(preview.container.innerHTML).toBe(publicView.container.querySelector(".cer-container")!.outerHTML);
});

it("changes only the title text across preview, saved, and printed certificates", () => {
  setCertificate("AAAAAAAAAAAA");
  const publicView = render(<Page />);
  const originalDocument = publicView.container.querySelector(".cer-container")!.outerHTML;
  const saved = familyFormSchema.parse({ ...form, certificateType: "warish" });
  state.data = { ...state.data!, form: saved };
  publicView.rerender(<Page />);
  const warishDocument = publicView.container.querySelector(".cer-container")!;
  expect(warishDocument.querySelector("h1")).toHaveTextContent("ওয়ারিশ সনদ");
  const normalized = warishDocument.cloneNode(true) as HTMLElement;
  normalized.querySelector("h1")!.textContent = "পারিবারিক সনদ";
  expect(normalized.outerHTML).toBe(originalDocument);
  const successView = render(<SuccessPage />);
  expect(successView.container.innerHTML).toBe(publicView.container.querySelector(".certificate-page")!.outerHTML);
  const preview = render(<CertificateDocument data={toDocument(saved, "00000001")}
    verificationUrl={`${window.location.origin}/verify/AAAAAAAAAAAA`} />);
  expect(preview.container.innerHTML).toBe(warishDocument.outerHTML);
  const print = vi.spyOn(window, "print").mockImplementation(() => {
    expect(warishDocument.querySelector("h1")).toHaveTextContent("ওয়ারিশ সনদ");
  });
  fireEvent.click(within(publicView.container).getByRole("button", { name: /প্রিন্ট করুন A4/ }));
  expect(print).toHaveBeenCalledOnce();
  state.data = { ...state.data!, form: familyFormSchema.parse({ ...form, certificateType: "family" }) };
  publicView.rerender(<Page />);
  expect(publicView.container.querySelector(".cer-container")!.outerHTML).toBe(originalDocument);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  state.navigate.mockReset();
});

it.each([282, 284, 320, 375, 768])("fits the complete page at %spx without changing the certificate", (width) => {
  setCertificate("AAAAAAAAAAAA");
  const originalStyles = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    if (element.matches(".cer-container")) return {
      width: "630px", paddingLeft: "5px", paddingRight: "5px",
      borderLeftWidth: "22.4px", borderRightWidth: "22.4px", borderImageOutset: "1.2",
    } as CSSStyleDeclaration;
    if (element.matches(".certificate-scroll")) return {
      paddingLeft: "28px", paddingRight: "28px",
    } as CSSStyleDeclaration;
    return originalStyles(element);
  });
  let viewportWidth = width;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.matches(".verification-viewport") ? viewportWidth : 0;
  });
  const disconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn();
    disconnect = disconnect;
  });
  const view = render(<Page />);
  const frame = view.container.querySelector<HTMLElement>(".verification-viewport")!;
  const certificate = view.container.querySelector(".cer-container")!;
  const unchanged = certificate.outerHTML;
  const pageWidth = () => parseFloat(frame.style.getPropertyValue("--certificate-mobile-width"));
  const zoom = () => Number(frame.style.getPropertyValue("--certificate-mobile-zoom"));
  expect(pageWidth()).toBeCloseTo(740.8);
  expect(pageWidth() * zoom()).toBeLessThanOrEqual(width + 0.001);
  expect((630 + 10 + 44.8 * 2.2) * zoom()).toBeLessThanOrEqual(width + 0.001);
  viewportWidth = 282;
  fireEvent(window, new Event("resize"));
  expect(pageWidth() * zoom()).toBeCloseTo(282);
  expect(certificate.outerHTML).toBe(unchanged);
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  fireEvent.click(within(view.container).getByRole("button", { name: /প্রিন্ট করুন A4/ }));
  expect(print).toHaveBeenCalledOnce();
  expect(certificate.outerHTML).toBe(unchanged);
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});

it("exits the certificate through browser history when Dashboard is pressed", () => {
  setCertificate("AAAAAAAAAAAA");
  vi.spyOn(window.history, "length", "get").mockReturnValue(2);
  const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "ড্যাশবোর্ড" }));
  expect(back).toHaveBeenCalledOnce();
  expect(state.navigate).not.toHaveBeenCalled();
});

it("exits to the app entry page when a public link has no previous history", () => {
  setCertificate("AAAAAAAAAAAA");
  vi.spyOn(window.history, "length", "get").mockReturnValue(1);
  const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "ড্যাশবোর্ড" }));
  expect(state.navigate).toHaveBeenCalledWith({ to: "/", replace: true });
  expect(back).not.toHaveBeenCalled();
});

it("uses the same certificate layout and print controls as the success page", () => {
  setCertificate("AAAAAAAAAAAA");
  const publicView = render(<Page />);
  const successView = render(<SuccessPage />);
  expect(publicView.container.querySelector(".certificate-page")!.outerHTML).toBe(successView.container.innerHTML);
  expect(
    publicView.container.querySelector(".certificate-page .certificate-scroll .cer-container"),
  ).toBeInTheDocument();
  expect(publicView.container.querySelector(".certificate-actions")).toHaveClass("no-print");
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  fireEvent.click(within(publicView.container).getByRole("button", { name: /প্রিন্ট করুন A4/ }));
  expect(print).toHaveBeenCalledOnce();
});

it("shows the saved designation under the signer's name on success and public verification", () => {
  setCertificate("AAAAAAAAAAAA");
  state.data = { ...state.data!, form: { ...form, designation: "প্যানেল চেয়ারম্যান -১" } };
  const publicView = render(<Page />);
  const successView = render(<SuccessPage />);
  for (const view of [publicView, successView]) {
    const signature = view.container.querySelector(".certificate-signature");
    expect(signature?.querySelector("strong")).toHaveTextContent("Signer");
    expect(signature).toHaveTextContent("প্যানেল চেয়ারম্যান -১");
    expect(signature?.querySelector("strong")?.nextSibling?.nodeName).toBe("BR");
  }
});

it("shows panel chairman 1 for older certificates without a saved designation", () => {
  setCertificate("AAAAAAAAAAAA");
  const publicView = render(<Page />);
  const successView = render(<SuccessPage />);
  for (const view of [publicView, successView]) {
    expect(view.container.querySelector(".certificate-signature")).toHaveTextContent(
      "প্যানেল চেয়ারম্যান -১",
    );
  }
});

it("updates the QR link when navigating between certificates", () => {
  setCertificate("AAAAAAAAAAAA");
  const view = render(<Page />);
  expect(screen.getByTestId("qr")).toHaveTextContent(
    `${window.location.origin}/verify/AAAAAAAAAAAA`,
  );
  setCertificate("BBBBBBBBBBBB");
  view.rerender(<Page />);
  expect(screen.getByTestId("qr")).toHaveTextContent(
    `${window.location.origin}/verify/BBBBBBBBBBBB`,
  );
  expect(screen.getByTestId("qr")).not.toHaveTextContent("tracking");
});

it("switches between found and missing certificates without a hook-order crash", () => {
  setCertificate("AAAAAAAAAAAA");
  const view = render(<Page />);
  state.data = null;
  view.rerender(<Page />);
  expect(screen.getByText("Certificate not found")).toBeInTheDocument();
  setCertificate("BBBBBBBBBBBB");
  view.rerender(<Page />);
  expect(screen.getByTestId("qr")).toHaveTextContent("BBBBBBBBBBBB");
});

it("prints the recommending member's ward separately from the applicant's ward", () => {
  setCertificate("AAAAAAAAAAAA");
  const { container } = render(<Page />);
  expect(container.querySelector(".inner-text")).toHaveTextContent("04");
  expect(container.querySelector(".certificate-summary")).toHaveTextContent("07 নং ওয়ার্ড");
});
