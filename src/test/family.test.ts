import { afterEach, describe, expect, it, vi } from "vitest";
import { ageOn, canAfford, familyFormSchema, padCertificateNo, toDocument, todayIso, type FamilyForm } from "@/lib/family";

const form: FamilyForm = { issueDate: "2026-07-25", applicantName: "মোঃ আক্তার মৃধা", applicantReg: "", father: "পিতা", mother: "মাতা", village: "তেতুলিয়া", wardNo: "4", house: "00-00-0000-00", remarks: "-", union: "০২ নং বহরপুর", upazila: "বালিয়াকান্দি", district: "রাজবাড়ী", ward: "4", signer: "মোঃ রেজাউল করিম", members: [{ name: "মোঃ আক্তার মৃধা", reg: "", dob: "1978-02-01", relation: "নিজ" }, { name: "সানি", reg: "2424636278", dob: "2004-12-11", relation: "পুত্র" }] };

describe("Family certificate rules", () => {
  afterEach(() => vi.useRealTimers());
  it("calculates age from birth date and issue date", () => {
    expect(ageOn("1978-02-01", "2026-07-25")).toBe(48);
    expect(ageOn("2004-12-11", "2026-07-25")).toBe(21);
    expect(ageOn("2000-07-26", "2026-07-25")).toBe(25);
  });
  it("pads certificate numbers to 8 digits", () => { expect(padCertificateNo(324)).toBe("00000324"); });
  it("blocks submission when balance is below cost", () => { expect(canAfford(0, 1)).toBe(false); expect(canAfford(1, 1)).toBe(true); });
  it("rejects future birth dates", () => {
    expect(familyFormSchema.safeParse({ ...form, members: [{ ...form.members[0]!, dob: "2027-01-01" }] }).success).toBe(false);
  });
  it.each(["2000-02-30", "1900-02-29", "2026-13-01", "2026-01-00", "0000-01-01"])("rejects impossible date %s", date => {
    expect(familyFormSchema.safeParse({ ...form, issueDate: date }).success).toBe(false);
    expect(familyFormSchema.safeParse({ ...form, members: [{ ...form.members[0]!, dob: date }] }).success).toBe(false);
  });
  it("accepts leap days in valid leap years", () => {
    expect(familyFormSchema.safeParse({ ...form, members: [{ ...form.members[0]!, dob: "2000-02-29" }] }).success).toBe(true);
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
