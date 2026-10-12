import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { familyFormSchema, type FamilyForm } from "./family";

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Storage unavailable");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, storage: undefined }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers);
    if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  } } });
}

export const verifyCertificate = createServerFn({ method: "GET" })
  .inputValidator(z.object({ publicId: z.string().regex(/^[A-Za-z0-9_-]{12}$/) }))
  .handler(async ({ data }) => {
    const { data: rows, error } = await publicClient().rpc("get_certificate_by_public_id", { p_public_id: data.publicId });
    if (error) throw new Error("Could not load certificate");
    const row = rows?.[0];
    if (!row) return null;
    return { publicId: row.public_id, certificateNo: row.certificate_no, form: row.data as unknown as FamilyForm, createdAt: row.created_at };
  });

export const getMe = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const sb = context.supabase;
  const [profile, admin, cost, next] = await Promise.all([
    sb.from("profiles").select("*").eq("user_id", context.userId).maybeSingle(),
    sb.rpc("is_admin"),
    sb.from("settings").select("value").eq("key", "cost_per_certificate").maybeSingle(),
    sb.rpc("next_certificate_no"),
  ]);
  if (profile.error) throw new Error("Could not load profile");
  return { profile: profile.data, email: (context.claims as { email?: string }).email ?? "", isAdmin: admin.data === true, cost: cost.data?.value ?? 1, nextNo: next.data ?? "00000001" };
});

export const submitCertificate = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => familyFormSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: publicId, error } = await context.supabase.rpc("submit_certificate", { p_data: data as never });
    if (error) {
      if (error.message.includes("INSUFFICIENT_TOKENS")) throw new Error("পর্যাপ্ত টোকেন নেই। অ্যাডমিনের সাথে যোগাযোগ করুন।");
      throw new Error("সনদ জমা দেওয়া যায়নি");
    }
    return { publicId: publicId as string };
  });

export const myCertificates = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("certificates").select("public_id,certificate_no,data,tokens_charged,created_at").eq("owner_id", context.userId).not("public_id", "is", null).order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error("Could not load certificates");
  return data.map(r => ({ publicId: r.public_id!, certificateNo: r.certificate_no!, applicant: (r.data as { applicantName?: string }).applicantName ?? "", tokens: r.tokens_charged ?? 0, createdAt: r.created_at }));
});

export const adminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const sb = context.supabase;
  const users = await sb.rpc("admin_list_users");
  if (users.error) throw new Error("Admin access required");
  const [certs, tx, cost] = await Promise.all([
    sb.from("certificates").select("public_id,certificate_no,owner_id,data,tokens_charged,created_at").not("public_id", "is", null).order("created_at", { ascending: false }).limit(1000),
    sb.from("token_transactions").select("*").order("created_at", { ascending: false }).limit(1000),
    sb.from("settings").select("value").eq("key", "cost_per_certificate").maybeSingle(),
  ]);
  return {
    users: users.data ?? [],
    cost: cost.data?.value ?? 1,
    certificates: (certs.data ?? []).map(r => ({ publicId: r.public_id!, certificateNo: r.certificate_no!, ownerId: r.owner_id, applicant: (r.data as { applicantName?: string }).applicantName ?? "", tokens: r.tokens_charged ?? 0, createdAt: r.created_at })),
    transactions: tx.data ?? [],
  };
});

export const adminAdjustTokens = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), mode: z.enum(["add", "remove", "set"]), amount: z.number().int().min(0).max(1_000_000), note: z.string().max(300) }))
  .handler(async ({ data, context }) => {
    const { data: balance, error } = await context.supabase.rpc("admin_adjust_tokens", { p_user: data.userId, p_mode: data.mode, p_amount: data.amount, p_note: data.note });
    if (error) throw new Error("টোকেন হালনাগাদ করা যায়নি");
    return { balance };
  });

export const adminSetCost = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ cost: z.number().int().min(0).max(100000) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("admin_set_cost", { p_cost: data.cost });
    if (error) throw new Error("খরচ সংরক্ষণ করা যায়নি");
    return { cost: data.cost };
  });

export const adminSetNextNo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator(z.object({ next: z.number().int().min(1).max(99999999) }))
  .handler(async ({ data, context }) => {
    const { data: no, error } = await context.supabase.rpc("admin_set_next_certificate_no", { p_next: data.next });
    if (error) throw new Error(error.message.includes("NUMBER_USED") ? "এই নম্বর বা এর চেয়ে বড় নম্বর আগেই ব্যবহৃত হয়েছে।" : "নম্বর সংরক্ষণ করা যায়নি");
    return { nextNo: no as string };
  });
