import { describe, expect, it } from "vitest";
import { summaryCounts, bengaliCount } from "@/lib/certificate";
describe("Family summary", () => {
  it("counts certificate 7298 as one son, daughter, spouse and self, four total", () => {
    const members = ["নিজ", "পুত্র", "কন্যা", "স্ত্রী"].map(relation => ({ relation, name: "সদস্য", birthDate: "01-01-2000", age: 26 }));
    expect(summaryCounts(members)).toEqual({ sons: 1, daughters: 1, spouse: 1, father: 0, mother: 0, brothers: 0, sisters: 0, self: 1, total: 4 });
    expect(bengaliCount(4)).toBe("চার");
  });
});