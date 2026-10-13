import { z } from "zod";

const text = z.string().trim().min(1).max(200);
const optionalText = z.string().trim().max(150);
export const memberSchema = z.object({ name: text, birthDate: z.string().regex(/^\d{2}-\d{2}-\d{4}$/), age: z.coerce.number().int().min(0).max(150), relation: text });
export const certificateSchema = z.object({
  certificateType: z.enum(["family", "warish"]).optional(),
  referenceId: z.string().regex(/^\d{1,12}$/), number: text,
  date: z.string().regex(/^\d{2}-\d{2}-\d{4}$/), union: text, upazila: text, district: text,
  subject: text, nationalId: optionalText, father: text, mother: text, village: text, ward: text, house: text,
  comment: z.string().trim().max(1000), signer: text, designation: optionalText,
  wardMember: optionalText.optional(),
  members: z.array(memberSchema).min(1).max(40),
});
export type Certificate = z.infer<typeof certificateSchema>;
export const summaryCounts = (members: Certificate["members"]) => ({
  sons: members.filter(m => m.relation.includes("পুত্র")).length,
  daughters: members.filter(m => m.relation.includes("কন্যা")).length,
  spouse: members.filter(m => /স্ত্রী|স্বামী/.test(m.relation)).length,
  father: members.filter(m => m.relation === "পিতা").length,
  mother: members.filter(m => m.relation === "মাতা").length,
  brothers: members.filter(m => m.relation.includes("ভাই")).length,
  sisters: members.filter(m => m.relation.includes("বোন")).length,
  self: members.filter(m => m.relation === "নিজ").length,
  total: members.length,
});
export const bengaliCount = (n: number) => ["শূন্য", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়", "দশ", "এগারো", "বারো", "তেরো", "চৌদ্দ", "পনেরো", "ষোল", "সতেরো", "আঠারো", "উনিশ", "বিশ"][n] ?? String(n);