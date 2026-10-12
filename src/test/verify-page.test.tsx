import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import type { FamilyForm } from "@/lib/family";

const state = vi.hoisted(() => ({
  publicId: "AAAAAAAAAAAA",
  data: null as { publicId: string; certificateNo: string; form: FamilyForm } | null,
}));
vi.mock("@tanstack/react-router", () => ({
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
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("uses the same certificate layout and print controls as the success page", () => {
  setCertificate("AAAAAAAAAAAA");
  const publicView = render(<Page />);
  const successView = render(<SuccessPage />);
  expect(publicView.container.innerHTML).toBe(successView.container.innerHTML);
  expect(
    publicView.container.querySelector(".certificate-page .certificate-scroll .cer-container"),
  ).toBeInTheDocument();
  expect(publicView.container.querySelector(".certificate-actions")).toHaveClass("no-print");
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  fireEvent.click(within(publicView.container).getByRole("button", { name: /প্রিন্ট করুন A4/ }));
  expect(print).toHaveBeenCalledOnce();
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
