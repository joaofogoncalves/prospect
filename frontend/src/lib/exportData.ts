import type { IntakeStats } from "@/lib/api";
import { downloadBlob } from "@/lib/exportChart";

// Serialize rows to CSV, quoting any field that contains a comma, quote, or
// newline (RFC 4180-style, with doubled quotes for escaping).
export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (value: string | number) => {
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = headers.map(esc).join(",");
  const body = rows
    .map((row) => headers.map((h) => esc(row[h])).join(","))
    .join("\n");
  return `${head}\n${body}`;
}

// Flatten the multi-section stats into one tidy long-format table
// (`section,label,count`) — usable directly in any spreadsheet. The full,
// lossless export is the JSON dump below.
export function statsToLongRows(
  stats: IntakeStats,
): { section: string; label: string; count: number }[] {
  const rows: { section: string; label: string; count: number }[] = [];
  for (const [label, count] of Object.entries(stats.totals)) {
    rows.push({ section: "totals", label, count });
  }
  for (const r of stats.byStatus) {
    rows.push({ section: "status", label: r.status, count: r.count });
  }
  for (const r of stats.byTag) {
    rows.push({ section: "tag", label: r.tag, count: r.count });
  }
  for (const r of stats.byIndustry) {
    rows.push({ section: "industry", label: r.industry, count: r.count });
  }
  for (const r of stats.overTime) {
    rows.push({ section: "overTime", label: r.date, count: r.count });
  }
  for (const u of stats.leaderboard) {
    rows.push({ section: "leaderboard", label: u.name || u.email, count: u.count });
  }
  return rows;
}

export function exportStatsCsv(stats: IntakeStats): void {
  downloadBlob(
    "intake-stats.csv",
    new Blob([toCsv(statsToLongRows(stats))], { type: "text/csv;charset=utf-8" }),
  );
}

export function exportStatsJson(stats: IntakeStats): void {
  downloadBlob(
    "intake-stats.json",
    new Blob([JSON.stringify(stats, null, 2)], { type: "application/json" }),
  );
}
