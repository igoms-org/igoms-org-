import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Plus, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AppHeader, useMe } from "@/components/app-header";
import { CertificateDocument } from "@/components/certificate-document";
import { submitCertificate } from "@/lib/certificates.functions";
import {
  RELATIONS,
  canAfford,
  familyFormSchema,
  toDocument,
  todayIso,
  type FamilyForm,
} from "@/lib/family";

export const Route = createFileRoute("/_authenticated/form")({
  head: () => ({
    meta: [
      { title: "নতুন পারিবারিক সনদ" },
      { name: "description", content: "পারিবারিক সনদের তথ্য পূরণ করে জমা দিন।" },
      { property: "og:title", content: "নতুন পারিবারিক সনদ" },
      { property: "og:description", content: "লাইভ পূর্বরূপসহ পারিবারিক সনদ ফরম।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormPage,
});

const blank = (): FamilyForm => ({
  issueDate: todayIso(),
  applicantName: "",
  applicantReg: "",
  father: "",
  mother: "",
  village: "",
  wardNo: "",
  house: "00-00-0000-00",
  remarks: "-",
  union: "",
  upazila: "",
  district: "",
  ward: "",
  signer: "",
  members: [{ name: "", reg: "", dob: "", relation: "নিজ" }],
});

function FormPage() {
  const me = useMe();
  const [f, setF] = useState<FamilyForm>(blank);
  const [loadedDefaults, setLoadedDefaults] = useState(false);
  const [error, setError] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [regUnlocked, setRegUnlocked] = useState(false);
  const submit = useServerFn(submitCertificate);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const p = me.data?.profile;
  useEffect(() => {
    if (!p || loadedDefaults) return;
    setF((v) => ({
      ...v,
      union: p.union_name_and_no,
      upazila: p.upazila,
      district: p.district,
      ward: p.ward_member_no,
      signer: p.chairman_name,
    }));
    setLoadedDefaults(true);
  }, [p, loadedDefaults]);

  const balance = p?.token_balance ?? 0;
  const cost = me.data?.cost ?? 1;
  const parsedForm = familyFormSchema.safeParse(f);
  const validation = showValidation ? parsedForm : null;
  const fieldErrors: Record<string, string> = {};
  if (validation && !validation.success) {
    for (const issue of validation.error.issues) {
      const path = issue.path.join(".");
      fieldErrors[path] ??= issue.message;
    }
  }
  const errorProps = (path: string, id: string) => ({
    "aria-invalid": Boolean(fieldErrors[path]),
    "aria-describedby": fieldErrors[path] ? `${id}-error` : undefined,
  });
  const fieldError = (path: string, id: string) =>
    fieldErrors[path] ? (
      <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-destructive">
        {fieldErrors[path]}
      </p>
    ) : null;
  const set = <K extends keyof FamilyForm>(k: K, v: FamilyForm[K]) =>
    setF((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "applicantName" || k === "applicantReg")
        next.members = next.members.map((m, i) =>
          i === 0 ? { ...m, name: next.applicantName, reg: next.applicantReg } : m,
        );
      return next;
    });
  const setMember = (i: number, patch: Partial<FamilyForm["members"][number]>) =>
    setF((prev) => ({
      ...prev,
      members: prev.members.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    }));
  const field = (
    k:
      | "applicantName"
      | "applicantReg"
      | "father"
      | "mother"
      | "village"
      | "wardNo"
      | "house"
      | "union"
      | "upazila"
      | "district"
      | "ward"
      | "signer",
    label: string,
    optional = false,
  ) => (
    <div>
      <Label htmlFor={k}>
        {label}
        {!optional && " *"}
      </Label>
      <Input
        id={k}
        value={f[k]}
        maxLength={k === "applicantReg" ? 100 : k === "ward" ? 20 : 200}
        {...errorProps(k, k)}
        inputMode={k === "wardNo" || k === "ward" ? "numeric" : undefined}
        onChange={(e) => set(k, e.target.value)}
      />
      {fieldError(k, k)}
    </div>
  );

  function onSubmit() {
    setShowValidation(true);
    const r = familyFormSchema.safeParse(f);
    if (!r.success) {
      setError("");
      return;
    }
    if (!canAfford(balance, cost)) {
      setError(
        "পর্যাপ্ত টোকেন নেই। অ্যাডমিনের সাথে যোগাযোগ করুন। (Not enough tokens. Contact admin.)",
      );
      return;
    }
    setError("");
    setConfirm(true);
  }
  async function doSubmit() {
    const parsed = familyFormSchema.safeParse(f);
    if (!parsed.success) {
      setShowValidation(true);
      setConfirm(false);
      return;
    }
    setBusy(true);
    try {
      const { publicId } = await submit({ data: parsed.data });
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: "/success/$publicId", params: { publicId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "জমা দেওয়া যায়নি");
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <AppHeader />
      <main className="mx-auto max-w-7xl p-4">
        <div className="no-print mb-4 flex flex-wrap gap-4 rounded-md border bg-card p-3 text-sm">
          <span>
            আপনার টোকেন: <b>{balance}</b>
          </span>
          <span>
            প্রতি সনদের খরচ: <b>{cost}</b> টোকেন
          </span>
        </div>
        <div className="app-layout">
          <form
            noValidate
            className="no-print space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-primary">সনদের তথ্য</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="no">সনদ নং</Label>
                  <Input id="no" value={me.data?.nextNo ?? ""} readOnly disabled />
                </div>
                <div>
                  <Label htmlFor="issueDate">তারিখ *</Label>
                  <Input
                    id="issueDate"
                    type="date"
                    value={f.issueDate}
                    {...errorProps("issueDate", "issueDate")}
                    onChange={(e) => set("issueDate", e.target.value)}
                  />
                  {fieldError("issueDate", "issueDate")}
                </div>
              </div>
            </section>
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-primary">আবেদনকারী</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {field("applicantName", "নাম")}
                {field("applicantReg", "জন্ম নিবন্ধন নং", true)}
                {field("father", "পিতার নাম")}
                {field("mother", "মাতার নাম")}
                {field("village", "গ্রাম")}
                {field("wardNo", "ওয়ার্ড নং")}
                {field("house", "বাসা নং")}
              </div>
              <div>
                <Label htmlFor="remarks">মন্তব্য</Label>
                <Textarea
                  id="remarks"
                  value={f.remarks}
                  maxLength={1000}
                  {...errorProps("remarks", "remarks")}
                  onChange={(e) => set("remarks", e.target.value)}
                />
                {fieldError("remarks", "remarks")}
              </div>
            </section>
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-primary">ইস্যুকারী</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {field("union", "ইউনিয়নের নাম ও নং (যেমন: ০২ নং বহরপুর)")}
                {field("upazila", "উপজেলা")}
                {field("district", "জেলা")}
                {field("ward", "সুপারিশকারী ওয়ার্ড সদস্যের ওয়ার্ড নং", true)}
                {field("signer", "চেয়ারম্যানের নাম")}
              </div>
            </section>
            <section className="space-y-3">
              {fieldError("members", "members")}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-primary">পরিবারের সদস্য</h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={f.members.length >= 40}
                  onClick={() =>
                    setF((v) => ({
                      ...v,
                      members: [...v.members, { name: "", reg: "", dob: "", relation: "পুত্র" }],
                    }))
                  }
                >
                  <Plus />
                  সদস্য যোগ
                </Button>
              </div>
              {f.members.map((m, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 items-end gap-2 border-b pb-3 sm:grid-cols-[2.5rem_2fr_1.5fr_1.5fr_1.2fr_2.25rem]"
                >
                  <span className="pb-2 font-semibold">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <Label htmlFor={`m${i}n`}>নাম</Label>
                    <Input
                      id={`m${i}n`}
                      value={m.name}
                      disabled={i === 0}
                      maxLength={200}
                      {...errorProps(`members.${i}.name`, `m${i}n`)}
                      onChange={(e) => setMember(i, { name: e.target.value })}
                    />
                    {fieldError(`members.${i}.name`, `m${i}n`)}
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <Label htmlFor={`m${i}r`}>জন্ম নিবন্ধন</Label>
                      {i === 0 && (
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={regUnlocked}
                            onChange={(e) => setRegUnlocked(e.target.checked)}
                          />
                          পরিবর্তন
                        </label>
                      )}
                    </div>
                    <Input
                      id={`m${i}r`}
                      value={m.reg}
                      disabled={i === 0 && !regUnlocked}
                      maxLength={100}
                      {...errorProps(`members.${i}.reg`, `m${i}r`)}
                      onChange={(e) => setMember(i, { reg: e.target.value })}
                    />
                    {fieldError(`members.${i}.reg`, `m${i}r`)}
                  </div>
                  <div>
                    <Label htmlFor={`m${i}d`}>জন্ম তারিখ</Label>
                    <Input
                      id={`m${i}d`}
                      type="date"
                      max={f.issueDate}
                      value={m.dob}
                      {...errorProps(`members.${i}.dob`, `m${i}d`)}
                      onChange={(e) => setMember(i, { dob: e.target.value })}
                    />
                    {fieldError(`members.${i}.dob`, `m${i}d`)}
                  </div>
                  <div>
                    <Label htmlFor={`m${i}rel`}>সম্পর্ক</Label>
                    <select
                      id={`m${i}rel`}
                      className="h-9 w-full rounded-md border border-input bg-background px-2"
                      value={m.relation}
                      disabled={i === 0}
                      {...errorProps(`members.${i}.relation`, `m${i}rel`)}
                      onChange={(e) =>
                        setMember(i, {
                          relation: e.target.value as FamilyForm["members"][number]["relation"],
                        })
                      }
                    >
                      {RELATIONS.filter((r) => i === 0 || r !== "নিজ").map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    {fieldError(`members.${i}.relation`, `m${i}rel`)}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`সদস্য ${i + 1} মুছুন`}
                    disabled={i === 0}
                    onClick={() =>
                      setF((v) => ({ ...v, members: v.members.filter((_, j) => j !== i) }))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </section>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !me.data}>
              <Send />
              জমা দিন
            </Button>
          </form>
          <div className="preview-box">
            <CertificateDocument
              data={toDocument(
                parsedForm.success ? parsedForm.data : f,
                me.data?.nextNo ?? "00000000",
              )}
              verificationUrl="preview"
            />
          </div>
        </div>
      </main>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>সনদ জমা নিশ্চিত করুন</AlertDialogTitle>
            <AlertDialogDescription>
              এতে {cost} টোকেন খরচ হবে। আপনার ব্যালান্স: {balance}। চালিয়ে যাবেন? (This will cost{" "}
              {cost} tokens. Your balance: {balance}. Continue?)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void doSubmit();
              }}
            >
              {busy ? "জমা হচ্ছে…" : "হ্যাঁ, জমা দিন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
