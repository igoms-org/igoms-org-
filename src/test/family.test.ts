import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ageOn,
  canAfford,
  familyFormSchema,
  padCertificateNo,
  toDocument,
  todayIso,
  type FamilyForm,
} from "@/lib/family";

const form: FamilyForm = {
  issueDate: "2026-07-25",
  applicantName: "মোঃ আক্তার মৃধা",
  applicantReg: "",
  father: "পিতা",
  mother: "মাতা",
  village: "তেতুলিয়া",
  wardNo: "4",
  house: "00-00-0000-00",
  remarks: "-",
  union: "০২ নং বহরপুর",
  upazila: "বালিয়াকান্দি",
  district: "রাজবাড়ী",
  ward: "4",
  signer: "মোঃ রেজাউল করিম",
  members: [
    { name: "মোঃ আক্তার মৃধা", reg: "", dob: "1978-02-01", relation: "নিজ" },
    { name: "সানি", reg: "2424636278", dob: "2004-12-11", relation: "পুত্র" },
  ],
};

describe("Family certificate rules", () => {
  it("uses the independent saved QR ID without changing any other document data", () => {
    const original = toDocument(form, "00000023");
    const saved = familyFormSchema.parse({ ...form, qrId: 2156 });
    expect(toDocument(saved, "00000023")).toEqual({ ...original, referenceId: "2156" });
    expect(toDocument(saved, "00000023", 9999).referenceId).toBe("2156");
  });
  it("previews the next QR ID independently of the certificate number", () => {
    expect(toDocument(form, "00000023", 2157)).toMatchObject({ referenceId: "2157", number: "00000023" });
    expect(toDocument(form, "00000023").referenceId).toBe("00000023");
  });
  afterEach(() => vi.useRealTimers());
  it("defaults previously saved forms without a designation to panel chairman 1", () => {
    expect(toDocument(familyFormSchema.parse(form), "00000001").designation).toBe(
      "প্যানেল চেয়ারম্যান -১",
    );
  });
  it("preserves an explicitly saved chairman designation", () => {
    expect(
      toDocument(familyFormSchema.parse({ ...form, designation: "চেয়ারম্যান" }), "00000001")
        .designation,
    ).toBe("চেয়ারম্যান");
  });
  it("preserves a selected panel chairman designation in the printed document", () => {
    const saved = familyFormSchema.parse({ ...form, designation: " প্যানেল চেয়ারম্যান -১ " });
    expect(toDocument(saved, "00000001").designation).toBe("প্যানেল চেয়ারম্যান -১");
  });
  it("rejects a blank designation when the user supplies the field", () => {
    expect(familyFormSchema.safeParse({ ...form, designation: " " }).success).toBe(false);
  });
  it("calculates age from birth date and issue date", () => {
    expect(ageOn("1978-02-01", "2026-07-25")).toBe(48);
    expect(ageOn("2004-12-11", "2026-07-25")).toBe(21);
    expect(ageOn("2000-07-26", "2026-07-25")).toBe(25);
  });
  it("pads certificate numbers to 8 digits", () => {
    expect(padCertificateNo(324)).toBe("00000324");
  });
  it("blocks submission when balance is below cost", () => {
    expect(canAfford(0, 1)).toBe(false);
    expect(canAfford(1, 1)).toBe(true);
  });
  it("rejects future birth dates", () => {
    expect(
      familyFormSchema.safeParse({ ...form, members: [{ ...form.members[0]!, dob: "2027-01-01" }] })
        .success,
    ).toBe(false);
  });
  it.each(["০৪", "04", "০4"])("accepts and normalizes ward digits %s", (wardNo) => {
    const result = familyFormSchema.parse({ ...form, wardNo, ward: "০৭" });
    expect(result.wardNo).toBe("04");
    expect(result.ward).toBe("07");
  });
  it.each(["", "   ", "ওয়ার্ড ৪", "4.5", "-4", "১২৩৪"])("rejects invalid ward %s", (wardNo) => {
    const result = familyFormSchema.safeParse({ ...form, wardNo });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.some((issue) => issue.path[0] === "wardNo")).toBe(true);
  });
  it.each(["মোঃ আক্তার মৃধা", "Mary-Jane O'Connor", "সানি Ahmed"])(
    "accepts valid name %s",
    (name) => {
      expect(
        familyFormSchema.safeParse({
          ...form,
          applicantName: name,
          members: [{ ...form.members[0]!, name }],
        }).success,
      ).toBe(true);
    },
  );
  it("rejects a blank member name at that member's field", () => {
    const result = familyFormSchema.safeParse({
      ...form,
      members: [form.members[0], { ...form.members[1], name: "  " }],
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["members", 1, "name"]);
  });
  it("normalizes ISO dates without changing their calendar day", () => {
    const result = familyFormSchema.parse({
      ...form,
      issueDate: " ২০২৬-০৭-২৫ ",
      members: [{ ...form.members[0]!, dob: "২০০০-০২-২৯" }],
    });
    expect(result.issueDate).toBe("2026-07-25");
    expect(result.members[0]?.dob).toBe("2000-02-29");
    expect(toDocument(result, "00000001").members[0]?.birthDate).toBe("29-02-2000");
  });
  it.each([
    "2000-02-30",
    "1900-02-29",
    "2026-13-01",
    "2026-01-00",
    "0000-01-01",
    "25-07-2026",
    "2026-7-25",
  ])("rejects impossible or incorrectly formatted date %s", (date) => {
    expect(familyFormSchema.safeParse({ ...form, issueDate: date }).success).toBe(false);
    expect(
      familyFormSchema.safeParse({ ...form, members: [{ ...form.members[0]!, dob: date }] })
        .success,
    ).toBe(false);
  });
  it("accepts leap days in valid leap years", () => {
    expect(
      familyFormSchema.safeParse({ ...form, members: [{ ...form.members[0]!, dob: "2000-02-29" }] })
        .success,
    ).toBe(true);
  });
  it("uses the Bangladesh date before UTC midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T20:00:00Z"));
    expect(todayIso()).toBe("2026-10-12");
    vi.setSystemTime(new Date("2026-10-12T17:59:59Z"));
    expect(todayIso()).toBe("2026-10-12");
    vi.setSystemTime(new Date("2026-10-12T18:00:00Z"));
    expect(todayIso()).toBe("2026-10-13");
  });
  it("shows a dash in brackets for empty birth registration numbers", () => {
    const doc = toDocument(form, "00000001");
    expect(doc.members[0]?.name).toBe("মোঃ আক্তার মৃধা (-)");
    expect(doc.nationalId).toBe("-");
  });
});
