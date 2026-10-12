import { describe, expect, it } from "vitest";
import { ageOn, canAfford, familyFormSchema, padCertificateNo, toDocument, type FamilyForm } from "@/lib/family";

const form: FamilyForm = { issueDate: "2026-07-25", applicantName: "মোঃ আক্তার মৃধা", applicantReg: "", father: "পিতা", mother: "মাতা", village: "তেতুলিয়া", wardNo: "4", house: "00-00-0000-00", remarks: "-", union: "০২ নং বহরপুর", upazila: "বালিয়াকান্দি", district: "রাজবাড়ী", ward: "4", signer: "মোঃ রেজাউল করিম", members: [{ name: "মোঃ আক্তার মৃধা", reg: "", dob: "1978-02-01", relation: "নিজ" }, { name: "সানি", reg: "2424636278", dob: "2004-12-11", relation: "পুত্র" }] };

describe("Family certificate rules", () => {
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
  it("shows a dash in brackets for empty birth registration numbers", () => {
    const doc = toDocument(form, "00000001");
    expect(doc.members[0]?.name).toBe("মোঃ আক্তার মৃধা (-)");
    expect(doc.nationalId).toBe("-");
  });
});
