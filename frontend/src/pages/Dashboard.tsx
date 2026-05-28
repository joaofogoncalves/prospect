import { useRef, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChevronDown,
  Download,
  FileJson,
  Printer,
  Sheet,
  Trophy,
} from "lucide-react";
import { intakesApi, type IntakeStats } from "@/lib/api";
import { useQuery } from "@/lib/useQuery";
import { useChartColors, type ChartColors } from "@/lib/useChartColors";
import { exportChartPng } from "@/lib/exportChart";
import { exportStatsCsv, exportStatsJson } from "@/lib/exportData";
import { Layout } from "@/components/Layout";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const CHART_HEIGHT = 260;

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const colors = useChartColors();
  const { data, loading, error, reload } = useQuery(() => intakesApi.stats());

  return (
    <Layout>
      <div className="pi-no-print mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Team-wide intake stats — counts by status, tags, industry, and people.
          </p>
        </div>
        {data && data.totals.intakes > 0 && <ExportMenu stats={data} />}
      </div>

      {loading && <LoadingState rows={4} />}

      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && data.totals.intakes === 0 && (
        <EmptyState
          title="No intakes yet"
          description="Stats appear here once the first project intake is submitted."
          action={
            <Button onClick={() => navigate("/intakes/new")}>Create intake</Button>
          }
        />
      )}

      {!loading && !error && data && data.totals.intakes > 0 && (
        <div id="dashboard-report" className="grid gap-6">
          <KpiRow totals={data.totals} />

          <div className="grid gap-6 md:grid-cols-2">
            <ChartCard title="Analysis status" filename="analysis-status" colors={colors}>
              <StatusDonut totals={data.totals} colors={colors} />
            </ChartCard>

            <ChartCard
              title="Analysis lifecycle"
              filename="analysis-lifecycle"
              colors={colors}
              empty={data.byStatus.length === 0}
            >
              <LifecycleBars data={data.byStatus} colors={colors} />
            </ChartCard>

            <ChartCard
              title="Top tags"
              filename="top-tags"
              colors={colors}
              empty={data.byTag.length === 0}
              emptyNote="Tags appear once intakes are analyzed."
            >
              <CategoryBars
                data={data.byTag.slice(0, 10).map((t) => ({
                  label: t.tag,
                  count: t.count,
                }))}
                colors={colors}
              />
            </ChartCard>

            <ChartCard
              title="By industry"
              filename="by-industry"
              colors={colors}
              empty={data.byIndustry.length === 0}
            >
              <CategoryBars
                data={data.byIndustry.slice(0, 10).map((i) => ({
                  label: i.industry,
                  count: i.count,
                }))}
                colors={colors}
              />
            </ChartCard>
          </div>

          <ChartCard
            title="Intakes over time"
            filename="intakes-over-time"
            colors={colors}
            empty={data.overTime.length === 0}
          >
            <OverTimeLine data={data.overTime} colors={colors} />
          </ChartCard>

          <Leaderboard rows={data.leaderboard} colors={colors} />
        </div>
      )}
    </Layout>
  );
}

// --- Export toolbar ----------------------------------------------------------

function ExportMenu({ stats }: { stats: IntakeStats }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer />
        Export report
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
          <Download />
          Data
          <ChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => exportStatsCsv(stats)}>
            <Sheet />
            Download CSV
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportStatsJson(stats)}>
            <FileJson />
            Download JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// --- KPI cards ---------------------------------------------------------------

function KpiRow({ totals }: { totals: IntakeStats["totals"] }) {
  const cards = [
    { label: "Total intakes", value: totals.intakes },
    { label: "Analyzed", value: totals.analyzed },
    { label: "Not analyzed", value: totals.notAnalyzed },
    { label: "Contributors", value: totals.contributors },
  ];
  return (
    <div className="pi-report-section grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} size="sm">
          <CardContent>
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
              {c.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Chart card shell --------------------------------------------------------

// A titled card wrapping one chart, with a "PNG" download button that serializes
// the chart's <svg> (see exportChartPng). Each gets `pi-report-section` so it
// stays whole when the dashboard is printed to PDF.
function ChartCard({
  title,
  filename,
  colors,
  empty = false,
  emptyNote = "No data yet.",
  children,
}: {
  title: string;
  filename: string;
  colors: ChartColors;
  empty?: boolean;
  emptyNote?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <Card className="pi-report-section">
      <CardHeader className="border-b pb-3">
        <CardTitle>{title}</CardTitle>
        {!empty && (
          <CardAction className="pi-no-print">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Download ${title} chart as PNG`}
              onClick={() =>
                ref.current &&
                exportChartPng(ref.current, `${filename}.png`, colors.surface)
              }
            >
              <Download />
              PNG
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {empty ? (
          <p
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height: CHART_HEIGHT }}
          >
            {emptyNote}
          </p>
        ) : (
          <div ref={ref}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Individual charts -------------------------------------------------------

// Shared Recharts props. Animations are off: a dashboard load shouldn't perform
// (styleguide §6 — don't animate static loads), and a still chart makes PNG
// export deterministic. Axis/grid/tooltip colors come from the resolved tokens.
const noAnim = { isAnimationActive: false } as const;

function tooltipStyle(colors: ChartColors) {
  return {
    contentStyle: {
      background: colors.surface,
      border: `1px solid ${colors.grid}`,
      borderRadius: 8,
      fontSize: 12,
      color: colors.text,
    },
    labelStyle: { color: colors.text },
    itemStyle: { color: colors.text },
    cursor: { fill: colors.grid, fillOpacity: 0.3 },
  };
}

function axisTick(colors: ChartColors) {
  return { fill: colors.axis, fontSize: 12 };
}

function StatusDonut({
  totals,
  colors,
}: {
  totals: IntakeStats["totals"];
  colors: ChartColors;
}) {
  const data = [
    { name: "Analyzed", value: totals.analyzed, fill: colors.analyzed },
    { name: "Not analyzed", value: totals.notAnalyzed, fill: colors.notAnalyzed },
  ];
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          stroke={colors.surface}
          {...noAnim}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle(colors)} />
        <Legend wrapperStyle={{ fontSize: 12, color: colors.text }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function LifecycleBars({
  data,
  colors,
}: {
  data: IntakeStats["byStatus"];
  colors: ChartColors;
}) {
  const rows = data.map((d) => ({ status: titleCase(d.status), count: d.count }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis
          dataKey="status"
          tick={axisTick(colors)}
          tickLine={false}
          axisLine={{ stroke: colors.grid }}
        />
        <YAxis
          allowDecimals={false}
          tick={axisTick(colors)}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip {...tooltipStyle(colors)} />
        <Bar dataKey="count" fill={colors.primary} radius={[4, 4, 0, 0]} {...noAnim} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Horizontal bars for a labelled category breakdown (tags, industries).
function CategoryBars({
  data,
  colors,
}: {
  data: { label: string; count: number }[];
  colors: ChartColors;
}) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} stroke={colors.grid} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={axisTick(colors)}
          tickLine={false}
          axisLine={{ stroke: colors.grid }}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={axisTick(colors)}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
        />
        <Tooltip {...tooltipStyle(colors)} />
        <Bar dataKey="count" fill={colors.primary} radius={[0, 4, 4, 0]} {...noAnim} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function OverTimeLine({
  data,
  colors,
}: {
  data: IntakeStats["overTime"];
  colors: ChartColors;
}) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={colors.grid} />
        <XAxis
          dataKey="date"
          tick={axisTick(colors)}
          tickLine={false}
          axisLine={{ stroke: colors.grid }}
          tickFormatter={(d: string) => d.slice(5)}
        />
        <YAxis
          allowDecimals={false}
          tick={axisTick(colors)}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip {...tooltipStyle(colors)} />
        <Line
          type="monotone"
          dataKey="count"
          stroke={colors.primary}
          strokeWidth={2}
          dot={{ r: 3, fill: colors.primary }}
          {...noAnim}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// --- Leaderboard -------------------------------------------------------------

const MEDALS = ["🥇", "🥈", "🥉"];

function Leaderboard({
  rows,
  colors,
}: {
  rows: IntakeStats["leaderboard"];
  colors: ChartColors;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const top = rows.slice(0, 10);
  const chartData = top.map((r) => ({ label: r.name || r.email, count: r.count }));

  return (
    <Card className="pi-report-section">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-4 text-muted-foreground" />
          Leaderboard
        </CardTitle>
        <CardAction className="pi-no-print">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Download leaderboard chart as PNG"
            onClick={() =>
              ref.current &&
              exportChartPng(ref.current, "leaderboard.png", colors.surface)
            }
          >
            <Download />
            PNG
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div ref={ref}>
          <CategoryBars data={chartData} colors={colors} />
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm" aria-label="Leaderboard ranking">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-2.5 w-12">Rank</th>
                <th className="px-4 py-2.5">Person</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Intakes</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Analyzed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.userId}
                  className="border-b transition-colors last:border-0 odd:bg-muted/20"
                >
                  <td className="px-4 py-3 tabular-nums">
                    {i < MEDALS.length ? (
                      <span aria-label={`Rank ${i + 1}`}>{MEDALS[i]}</span>
                    ) : (
                      <span className="text-muted-foreground">{i + 1}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.name || r.email}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.count}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {r.analyzedCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
