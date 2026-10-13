import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ submit: vi.fn(), navigate: vi.fn(), invalidate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options }),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.submit }));
vi.mock("@/lib/certificates.functions", () => ({ submitCertificate: vi.fn() }));
vi.mock("@/components/app-header", () => ({
  AppHeader: () => null,
  useMe: () => ({
    data: {
      cost: 1,
      nextNo: "00000001",
      nextQrId: 2156,
      profile: {
        token_balance: 10,
        union_name_and_no: "Union",
        upazila: "Upazila",
        district: "District",
        ward_member_no: "০৭",
        chairman_name: "Signer",
      },
    },
  }),
}));
vi.mock("@/components/certificate-document", () => ({ CertificateDocument: () => null }));

import { Route } from "@/routes/_authenticated/form";
const Page = Route.options.component as React.ComponentType;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.submit.mockResolvedValue({ publicId: "AAAAAAAAAAAA" });
  mocks.invalidate.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

function input(id: string) {
  return document.getElementById(id) as HTMLInputElement;
}
function enter(id: string, value: string) {
  fireEvent.change(input(id), { target: { value } });
}
function fillForm(name = "মোঃ আক্তার মৃধা", wardNo = "০৪") {
  enter("issueDate", "2026-07-25");
  enter("applicantName", name);
  enter("father", "পিতা");
  enter("mother", "Mother");
  enter("village", "Village");
  enter("wardNo", wardNo);
  enter("m0d", "2000-02-29");
}
function submitForm() {
  fireEvent.click(screen.getByRole("button", { name: "জমা দিন" }));
}

it("selects the title outside the unchanged form and saves it without altering input data", async () => {
  render(<Page />);
  fillForm();
  const selector = screen.getByRole("combobox", { name: "সনদের ধরন" });
  expect(selector.closest("form")).toBeNull();
  expect(selector.closest(".no-print")).not.toBeNull();
  expect(selector).toHaveValue("family");
  const originalForm = document.querySelector("form")!.innerHTML;
  fireEvent.change(selector, { target: { value: "warish" } });
  expect(document.querySelector("form")!.innerHTML).toBe(originalForm);
  submitForm();
  fireEvent.click(screen.getByRole("button", { name: "হ্যাঁ, জমা দিন" }));
  await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith({
    data: expect.objectContaining({ certificateType: "warish", applicantName: "মোঃ আক্তার মৃধা",
      members: [expect.objectContaining({ name: "মোঃ আক্তার মৃধা", dob: "2000-02-29", relation: "নিজ" })] }),
  }));
});

it("allows switching back to the family title without changing form data", () => {
  render(<Page />);
  fillForm();
  const originalForm = document.querySelector("form")!.innerHTML;
  const selector = screen.getByRole("combobox", { name: "সনদের ধরন" });
  fireEvent.change(selector, { target: { value: "warish" } });
  fireEvent.change(selector, { target: { value: "family" } });
  expect(selector).toHaveValue("family");
  expect(document.querySelector("form")!.innerHTML).toBe(originalForm);
});

it("saves panel chairman 1 when the designation is left unchanged", async () => {
  render(<Page />);
  fillForm();
  expect(screen.getByRole("combobox", { name: "পদবি *" })).toHaveValue("প্যানেল চেয়ারম্যান -১");
  submitForm();
  fireEvent.click(screen.getByRole("button", { name: "হ্যাঁ, জমা দিন" }));
  await waitFor(() =>
    expect(mocks.submit).toHaveBeenCalledWith({
      data: expect.objectContaining({ designation: "প্যানেল চেয়ারম্যান -১" }),
    }),
  );
});

it("saves a manually typed designation when the checkbox is enabled", async () => {
  render(<Page />);
  fillForm();
  fireEvent.click(screen.getByRole("checkbox", { name: "পদবি নিজে লিখুন" }));
  expect(screen.getByRole("textbox", { name: "পদবি *" })).toBeInTheDocument();
  enter("designation", "ভারপ্রাপ্ত চেয়ারম্যান");
  submitForm();
  fireEvent.click(screen.getByRole("button", { name: "হ্যাঁ, জমা দিন" }));
  await waitFor(() =>
    expect(mocks.submit).toHaveBeenCalledWith({
      data: expect.objectContaining({ designation: "ভারপ্রাপ্ত চেয়ারম্যান" }),
    }),
  );
});

it("retains the dropdown choice and manual draft when switching modes", () => {
  render(<Page />);
  enter("designation", "প্যানেল চেয়ারম্যান -২");
  const toggle = screen.getByRole("checkbox", { name: "পদবি নিজে লিখুন" });
  fireEvent.click(toggle);
  expect(input("designation").value).toBe("প্যানেল চেয়ারম্যান -২");
  enter("designation", "ভারপ্রাপ্ত চেয়ারম্যান");
  fireEvent.click(toggle);
  expect(screen.getByRole("combobox", { name: "পদবি *" })).toHaveValue("প্যানেল চেয়ারম্যান -২");
  fireEvent.click(toggle);
  expect(screen.getByRole("textbox", { name: "পদবি *" })).toHaveValue("ভারপ্রাপ্ত চেয়ারম্যান");
});

it("still requires a designation in manual mode", () => {
  render(<Page />);
  fillForm();
  fireEvent.click(screen.getByRole("checkbox", { name: "পদবি নিজে লিখুন" }));
  enter("designation", " ");
  submitForm();
  expect(input("designation")).toHaveAccessibleDescription("পদবি লিখুন");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(mocks.submit).not.toHaveBeenCalled();
});

it.each([
  "চেয়ারম্যান",
  "প্যানেল চেয়ারম্যান -১",
  "প্যানেল চেয়ারম্যান -২",
  "প্যানেল চেয়ারম্যান -৩",
])(
  "saves the selected designation %s through the existing certificate submission",
  async (designation) => {
    render(<Page />);
    fillForm();
    expect(input("designation").value).toBe("প্যানেল চেয়ারম্যান -১");
    expect(screen.getByRole("combobox", { name: "পদবি *" }).tagName).toBe("SELECT");
    enter("designation", designation);
    expect(screen.getByRole("option", { name: designation })).toHaveProperty("selected", true);
    submitForm();
    fireEvent.click(screen.getByRole("button", { name: "হ্যাঁ, জমা দিন" }));
    await waitFor(() =>
      expect(mocks.submit).toHaveBeenCalledWith({
        data: expect.objectContaining({ designation }),
      }),
    );
  },
);

it.each([
  ["মোঃ আক্তার মৃধা", "০৪"],
  ["Mary-Jane O'Connor", "04"],
])("submits valid name %s and ward %s through the existing server function", async (name, ward) => {
  render(<Page />);
  fillForm(name, ward);
  expect(input("m0n").value).toBe(name);
  fireEvent.click(screen.getByRole("button", { name: "সদস্য যোগ" }));
  enter("m1n", "সানি Ahmed");
  enter("m1d", "2010-12-11");
  submitForm();
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(mocks.submit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "হ্যাঁ, জমা দিন" }));
  await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
  expect(mocks.submit).toHaveBeenCalledWith({
    data: expect.objectContaining({
      applicantName: name,
      wardNo: "04",
      ward: "07",
      issueDate: "2026-07-25",
      members: [
        expect.objectContaining({ name, dob: "2000-02-29", relation: "নিজ" }),
        expect.objectContaining({ name: "সানি Ahmed", dob: "2010-12-11", relation: "পুত্র" }),
      ],
    }),
  });
  await waitFor(() =>
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/success/$publicId",
      params: { publicId: "AAAAAAAAAAAA" },
    }),
  );
});

it("shows a ward error beside the ward input and clears it after correction", () => {
  render(<Page />);
  fillForm();
  enter("wardNo", "ওয়ার্ড ৪");
  submitForm();
  expect(input("wardNo")).toHaveAttribute("aria-invalid", "true");
  expect(input("wardNo")).toHaveAccessibleDescription(
    "ওয়ার্ড নং ১–৩ অঙ্কে লিখুন (যেমন: ০৪ বা 04)",
  );
  expect(document.getElementById("wardNo-error")?.parentElement).toContainElement(input("wardNo"));
  expect(mocks.submit).not.toHaveBeenCalled();
  enter("wardNo", "০৪");
  expect(input("wardNo")).toHaveAttribute("aria-invalid", "false");
  expect(document.getElementById("wardNo-error")).toBeNull();
  submitForm();
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
});

it("reports the specific missing member name and birth date", () => {
  render(<Page />);
  fillForm();
  fireEvent.click(screen.getByRole("button", { name: "সদস্য যোগ" }));
  submitForm();
  expect(input("m1n")).toHaveAccessibleDescription("এই তথ্যটি পূরণ করুন");
  expect(input("m1d")).toHaveAccessibleDescription("তারিখ দিন");
  expect(input("m0n")).toHaveAttribute("aria-invalid", "false");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(mocks.submit).not.toHaveBeenCalled();
});

it("rejects missing or future birth dates beside the date field", () => {
  render(<Page />);
  fillForm();
  enter("m0d", "");
  submitForm();
  expect(input("m0d")).toHaveAccessibleDescription("তারিখ দিন");
  enter("m0d", "2027-01-01");
  submitForm();
  expect(input("m0d")).toHaveAccessibleDescription("ভবিষ্যতের জন্ম তারিখ দেওয়া যাবে না");
  expect(mocks.submit).not.toHaveBeenCalled();
});

it("reports a missing issue date and still blocks an empty applicant name", () => {
  render(<Page />);
  fillForm();
  enter("issueDate", "");
  enter("applicantName", "  ");
  submitForm();
  expect(input("issueDate")).toHaveAccessibleDescription("তারিখ দিন");
  expect(input("applicantName")).toHaveAccessibleDescription("এই তথ্যটি পূরণ করুন");
  expect(input("m0d")).toHaveAttribute("aria-invalid", "false");
  expect(mocks.submit).not.toHaveBeenCalled();
});
