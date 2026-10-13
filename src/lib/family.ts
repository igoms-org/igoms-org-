import { z } from "zod";
import type { Certificate } from "./certificate";

export const DEFAULT_SIGNER_DESIGNATION = "প্যানেল চেয়ারম্যান -১";

export const RELATIONS = [
  "নিজ",
  "পুত্র",
  "কন্যা",
  "স্ত্রী",
  "স্বামী",
  "পিতা",
  "মাতা",
  "ভাই",
  "বোন",
] as const;
const req = z.string().trim().min(1, "এই তথ্যটি পূরণ করুন").max(200, "সর্বোচ্চ ২০০ অক্ষর লিখুন");
const opt = z.string().trim().max(100, "সর্বোচ্চ ১০০ অক্ষর লিখুন");
export const normalizeBanglaDigits = (value: string) =>
  value.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
const normalizedText = z.string().trim().transform(normalizeBanglaDigits);
// Native date inputs store yyyy-mm-dd, regardless of the displayed locale.
const isoDate = normalizedText.pipe(
  z
    .string()
    .min(1, "তারিখ দিন")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "সঠিক তারিখ দিন (YYYY-MM-DD)")
    .refine((value) => {
      const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
      const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
      const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0);
    }, "সঠিক তারিখ দিন"),
);

export const memberInputSchema = z.object({
  name: req,
  reg: opt,
  dob: isoDate,
  relation: z.enum(RELATIONS),
});
export const familyFormSchema = z
  .object({
    certificateType: z.enum(["family", "warish"]).optional(),
    issueDate: isoDate,
    applicantName: req,
    applicantReg: opt,
    father: req,
    mother: req,
    village: req,
    wardNo: normalizedText.pipe(
      z.string().regex(/^\d{1,3}$/, "ওয়ার্ড নং ১–৩ অঙ্কে লিখুন (যেমন: ০৪ বা 04)"),
    ),
    house: req,
    remarks: z.string().trim().max(1000, "সর্বোচ্চ ১০০০ অক্ষর লিখুন"),
    union: req,
    upazila: req,
    district: req,
    ward: normalizedText.pipe(z.string().max(20, "সর্বোচ্চ ২০ অক্ষর লিখুন")),
    signer: req,
    designation: z
      .string()
      .trim()
      .min(1, "পদবি লিখুন")
      .max(100, "সর্বোচ্চ ১০০ অক্ষর লিখুন")
      .optional(),
    members: z
      .array(memberInputSchema)
      .min(1, "অন্তত একজন সদস্য দিন")
      .max(40, "সর্বোচ্চ ৪০ জন সদস্য দেওয়া যাবে"),
  })
  .superRefine((v, ctx) => {
    if (isoDate.safeParse(v.issueDate).success) {
      v.members.forEach((m, i) => {
        if (isoDate.safeParse(m.dob).success && m.dob > v.issueDate)
          ctx.addIssue({
            code: "custom",
            path: ["members", i, "dob"],
            message: "ভবিষ্যতের জন্ম তারিখ দেওয়া যাবে না",
          });
      });
    }
    if (v.members[0]?.relation !== "নিজ")
      ctx.addIssue({
        code: "custom",
        path: ["members", 0, "relation"],
        message: "প্রথম সদস্য আবেদনকারী নিজে",
      });
  });
export type FamilyForm = z.infer<typeof familyFormSchema>;
export type MemberInput = z.infer<typeof memberInputSchema>;

/** Full years between birth date and issue date (ISO yyyy-mm-dd). */
export function ageOn(dob: string, issueDate: string): number {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [iy, im, id] = issueDate.split("-").map(Number);
  if (!by || !iy) return 0;
  let age = iy - by;
  if ((im ?? 0) < (bm ?? 0) || (im === bm && (id ?? 0) < (bd ?? 0))) age--;
  return Math.max(0, age);
}
export const toDisplayDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}-${m}-${y}` : "";
};
export const padCertificateNo = (n: number) => String(n).padStart(8, "0");
export const canAfford = (balance: number, cost: number) => balance >= cost;
export const todayIso = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

/** Maps saved form data onto the printable certificate document. */
export function toDocument(f: FamilyForm, certificateNo: string): Certificate {
  return {
    certificateType: f.certificateType ?? "family",
    referenceId: certificateNo.replace(/\D/g, "").slice(-12) || "0",
    number: certificateNo,
    date: toDisplayDate(f.issueDate),
    union: f.union || "-",
    upazila: f.upazila || "-",
    district: f.district || "-",
    subject: f.applicantName || "-",
    nationalId: f.applicantReg || "-",
    father: f.father || "-",
    mother: f.mother || "-",
    village: f.village || "-",
    ward: f.wardNo ? f.wardNo.padStart(2, "0") : "-",
    house: f.house || "-",
    comment: f.remarks || "-",
    signer: f.signer || "-",
    designation: f.designation ?? DEFAULT_SIGNER_DESIGNATION,
    wardMember: f.ward ? f.ward.padStart(2, "0") : "",
    members: f.members.map((m) => ({
      name: `${m.name || "-"} (${m.reg || "-"})`,
      birthDate: toDisplayDate(m.dob),
      age: ageOn(m.dob, f.issueDate),
      relation: m.relation,
    })),
  };
}
