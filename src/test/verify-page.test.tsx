import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { FamilyForm } from "@/lib/family";

const state = vi.hoisted(() => ({
  publicId: "AAAAAAAAAAAA",
  data: null as { publicId: string; certificateNo: string; form: FamilyForm } | null,
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useParams: () => ({ publicId: state.publicId }),
  }),
}));
vi.mock("@tanstack/react-query", async () => {
  const React = await vi.importActual<typeof import("react")>("react");
  return {
    queryOptions: (options: object) => options,
    useSuspenseQuery: () => {
      // Keep a real hook before the page's hooks, as React Query does.
      React.useState(0);
      return { data: state.data };
    },
  };
});
vi.mock("@/lib/certificates.functions", () => ({ verifyCertificate: vi.fn() }));
vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string }) => <span data-testid="qr">{value}</span>,
}));

import { Route } from "@/routes/verify.$publicId";
const Page = Route.options.component as React.ComponentType;
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
afterEach(() => cleanup());

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
