import { describe, it, expect } from "vitest";
import type { IntakeStats } from "@/lib/api";
import { statsToLongRows, toCsv } from "@/lib/exportData";

describe("toCsv", () => {
  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });

  it("emits a header row from the first object's keys", () => {
    const csv = toCsv([{ section: "tag", label: "ai-ml", count: 3 }]);
    expect(csv).toBe("section,label,count\ntag,ai-ml,3");
  });

  it("quotes and escapes fields containing commas, quotes, or newlines", () => {
    const csv = toCsv([
      { label: "Acme, Inc.", count: 1 },
      { label: 'say "hi"', count: 2 },
      { label: "two\nlines", count: 3 },
    ]);
    const [header, rest] = [csv.slice(0, csv.indexOf("\n")), csv];
    expect(header).toBe("label,count");
    // A field with a comma is wrapped in quotes; a literal quote is doubled; an
    // embedded newline stays inside the quoted field (not a new record).
    expect(rest).toContain('"Acme, Inc.",1');
    expect(rest).toContain('"say ""hi""",2');
    expect(rest).toContain('"two\nlines",3');
  });
});

describe("statsToLongRows", () => {
  const stats: IntakeStats = {
    totals: { intakes: 5, analyzed: 3, notAnalyzed: 2, contributors: 2 },
    byStatus: [{ status: "completed", count: 3 }],
    byTag: [{ tag: "ai-ml", count: 2 }],
    byIndustry: [{ industry: "Retail", count: 4 }],
    leaderboard: [
      { userId: "u1", name: "Ada", email: "ada@x.io", count: 3, analyzedCount: 2 },
      { userId: "u2", name: null, email: "rob@x.io", count: 2, analyzedCount: 1 },
    ],
    overTime: [{ date: "2026-05-28", count: 5 }],
  };

  it("flattens every section into section/label/count rows", () => {
    const rows = statsToLongRows(stats);
    expect(rows).toContainEqual({ section: "totals", label: "intakes", count: 5 });
    expect(rows).toContainEqual({ section: "tag", label: "ai-ml", count: 2 });
    expect(rows).toContainEqual({ section: "industry", label: "Retail", count: 4 });
    expect(rows).toContainEqual({ section: "overTime", label: "2026-05-28", count: 5 });
    // Leaderboard falls back to email when the name is null.
    expect(rows).toContainEqual({ section: "leaderboard", label: "Ada", count: 3 });
    expect(rows).toContainEqual({ section: "leaderboard", label: "rob@x.io", count: 2 });
  });
});
