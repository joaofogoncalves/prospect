import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/lib/theme";
import { deferred } from "@/test/utils";
import type { IntakeStats } from "@/lib/api";
import Dashboard from "@/pages/Dashboard";

// Mock the API boundary — only stats() is exercised here.
const statsMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  getToken: () => null,
  setToken: () => {},
  authApi: { changePassword: vi.fn() },
  MAX_REANALYSIS: 3,
  intakesApi: {
    stats: (...args: unknown[]) => statsMock(...args),
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    analyze: vi.fn(),
  },
}));

// AuthProvider is a pass-through; Layout just needs a user to label the menu.
vi.mock("@/lib/auth", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: { id: "u1", email: "you@example.com", name: "You" },
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Recharts' ResponsiveContainer measures 0×0 in jsdom; give its child concrete
// dimensions so the chart mounts and the assertions below see real DOM.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  const React = await import("react");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
      React.createElement(
        "div",
        { style: { width: 800, height: 400 } },
        React.cloneElement(children, { width: 800, height: 400 }),
      ),
  };
});

const stats = (over: Partial<IntakeStats> = {}): IntakeStats => ({
  totals: { intakes: 5, analyzed: 3, notAnalyzed: 2, contributors: 2 },
  byStatus: [
    { status: "completed", count: 3 },
    { status: "pending", count: 2 },
  ],
  byTag: [
    { tag: "ai-ml", count: 4 },
    { tag: "enterprise", count: 2 },
  ],
  byIndustry: [{ industry: "Retail", count: 5 }],
  leaderboard: [
    { userId: "u1", name: "Ada", email: "ada@x.io", count: 3, analyzedCount: 2 },
    { userId: "u2", name: null, email: "rob@x.io", count: 2, analyzedCount: 1 },
  ],
  overTime: [
    { date: "2026-05-27", count: 2 },
    { date: "2026-05-28", count: 3 },
  ],
  ...over,
});

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <ThemeProvider>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/intakes/new" element={<div>New intake page</div>} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  statsMock.mockReset();
});

describe("Dashboard", () => {
  it("shows a loading skeleton while stats are in flight, then the data", async () => {
    const d = deferred<IntakeStats>();
    statsMock.mockReturnValue(d.promise);

    renderDashboard();

    // Skeleton is up; KPI numbers are not there yet.
    expect(screen.queryByText("Total intakes")).toBeNull();

    d.resolve(stats());

    // KPIs render once the request settles.
    expect(await screen.findByText("Total intakes")).toBeInTheDocument();
    expect(screen.getByText("Contributors")).toBeInTheDocument();
  });

  it("renders KPIs, chart sections, and the leaderboard ranking", async () => {
    statsMock.mockResolvedValue(stats());

    renderDashboard();

    expect(await screen.findByText("Total intakes")).toBeInTheDocument();

    // Chart section titles.
    expect(screen.getByText("Analysis status")).toBeInTheDocument();
    expect(screen.getByText("Top tags")).toBeInTheDocument();
    expect(screen.getByText("Intakes over time")).toBeInTheDocument();
    expect(screen.getByText("Leaderboard")).toBeInTheDocument();

    // Leaderboard ranking table: both people, medal for #1, email fallback for
    // the unnamed user.
    const table = screen.getByRole("table", { name: "Leaderboard ranking" });
    expect(within(table).getByText("Ada")).toBeInTheDocument();
    expect(within(table).getByText("rob@x.io")).toBeInTheDocument();
    expect(within(table).getByLabelText("Rank 1")).toBeInTheDocument();

    // Export controls are present.
    expect(
      screen.getByRole("button", { name: "Export report" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Download .* chart as PNG/ }).length,
    ).toBeGreaterThan(0);
  });

  it("triggers the print dialog from Export report", async () => {
    statsMock.mockResolvedValue(stats());
    const printSpy = vi.fn();
    vi.stubGlobal("print", printSpy);

    const user = userEvent.setup();
    renderDashboard();

    await user.click(await screen.findByRole("button", { name: "Export report" }));
    expect(printSpy).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });

  it("shows an empty state (and no export toolbar) when there are no intakes", async () => {
    statsMock.mockResolvedValue(
      stats({
        totals: { intakes: 0, analyzed: 0, notAnalyzed: 0, contributors: 0 },
        byStatus: [],
        byTag: [],
        byIndustry: [],
        leaderboard: [],
        overTime: [],
      }),
    );

    renderDashboard();

    expect(await screen.findByText("No intakes yet")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Export report" }),
    ).toBeNull();
  });

  it("surfaces an error with a retry that refetches", async () => {
    statsMock
      .mockRejectedValueOnce(new Error("Request failed (500)"))
      .mockResolvedValueOnce(stats());

    const user = userEvent.setup();
    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Request failed (500)",
    );

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Total intakes")).toBeInTheDocument();
  });
});
