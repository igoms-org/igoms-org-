import { z } from "zod";
import type { Certificate } from "./certificate";

export const RELATIONS = ["নিজ", "পুত্র", "কন্যা", "স্ত্রী", "স্বামী", "পিতা", "মাতা", "ভাই", "বোন"] as const;
const req = z.string().trim().min(1).max(200);
const opt = z.string().trim().max(100);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const memberInputSchema = z.object({ name: req, reg: opt, dob: isoDate, relation: z.enum(RELATIONS) });
export const familyFormSchema = z.object({
  issueDate: isoDate,
  applicantName: req, applicantReg: opt, father: req, mother: req, village: req,
  wardNo: z.string().trim().regex(/^\d{1,3}$/), house: req, remarks: z.string().trim().max(1000),
  union: req, upazila: req, district: req, ward: z.string().trim().max(20), signer: req,
  members: z.array(memberInputSchema).min(1).max(40),
}).superRefine((v, ctx) => {
  v.members.forEach((m, i) => {
    if (m.dob > v.issueDate) ctx.addIssue({ code: "custom", path: ["members", i, "dob"], message: "ভবিষ্যতের জন্ম তারিখ দেওয়া যাবে না" });
  });
  if (v.members[0]?.relation !== "নিজ") ctx.addIssue({ code: "custom", path: ["members", 0], message: "প্রথম সদস্য আবেদনকারী নিজে" });
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
export const toDisplayDate = (iso: string) => { const [y, m, d] = iso.split("-"); return y && m && d ? `${d}-${m}-${y}` : ""; };
export const padCertificateNo = (n: number) => String(n).padStart(8, "0");
export const canAfford = (balance: number, cost: number) => balance >= cost;
export const todayIso = () => new Date().toISOString().slice(0, 10);

/** Maps saved form data onto the printable certificate document. */
export function toDocument(f: FamilyForm, certificateNo: string): Certificate {
  return {
    referenceId: certificateNo.replace(/\D/g, "").slice(-12) || "0",
    number: certificateNo, date: toDisplayDate(f.issueDate),
    union: f.union || "-", upazila: f.upazila || "-", district: f.district || "-",
    subject: f.applicantName || "-", nationalId: f.applicantReg || "-",
    father: f.father || "-", mother: f.mother || "-", village: f.village || "-",
    ward: f.wardNo ? f.wardNo.padStart(2, "0") : "-", house: f.house || "-", comment: f.remarks || "-",
    signer: f.signer || "-", designation: "চেয়ারম্যান", wardMember: f.ward ? f.ward.padStart(2, "0") : "",
    members: f.members.map(m => ({ name: `${m.name || "-"} (${m.reg || "-"})`, birthDate: toDisplayDate(m.dob), age: ageOn(m.dob, f.issueDate), relation: m.relation })),
  };
}
