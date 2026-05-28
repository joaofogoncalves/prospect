import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/lib/theme";
import IntakeDetail from "@/pages/IntakeDetail";

// Mock the api boundary (intakesApi + the constant that drives the countdown).
const getMock = vi.fn();
const analyzeMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  getToken: () => null,
  setToken: () => {},
  authApi: { changePassword: vi.fn() },
  MAX_REANALYSIS: 3,
  intakesApi: {
    get: (...args: unknown[]) => getMock(...args),
    analyze: (...args: unknown[]) => analyzeMock(...args),
    list: vi.fn(),
    create: vi.fn(),
  },
}));

// Control who's signed in (drives the owner-only actions). AuthProvider is a
// pass-through so we don't need the real session/me round-trip.
let currentUser: { id: string; email: string; name: string | null } | null = {
  id: "u1",
  email: "you@example.com",
  name: null,
};
vi.mock("@/lib/auth", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: currentUser,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

beforeEach(() => {
  getMock.mockReset();
  analyzeMock.mockReset();
  currentUser = { id: "u1", email: "you@example.com", name: null };
});

const intake = (over: Record<string, unknown> = {}) => ({
  id: "i1",
  title: "Forecasting platform",
  description: "Build a platform",
  budgetRange: "$2M – $4M",
  timeline: "9 months",
  industry: "Retail",
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
  summary: null,
  tags: null,
  riskChecklist: null,
  analyzedAt: null,
  analysisStatus: "pending",
  analysisError: null,
  analysisRunCount: 0,
  userId: "u1",
  user: { id: "u1", name: null, email: "you@example.com" },
  ...over,
});

function renderDetail(id = "i1") {
  return render(
    <MemoryRouter initialEntries={[`/intakes/${id}`]}>
      <ThemeProvider>
        <Routes>
          <Route path="/intakes/:id" element={<IntakeDetail />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("IntakeDetail — analysis states & re-analyze budget", () => {
  it("renders a completed analysis with the remaining-runs countdown", async () => {
    getMock.mockResolvedValue(
      intake({
        analysisStatus: "completed",
        analyzedAt: "2026-05-28T01:00:00.000Z",
        summary: "A retail enterprise wants a forecasting platform.",
        tags: ["ai-ml", "enterprise"],
        riskChecklist: ["Confirm data quality."],
        analysisRunCount: 0,
      }),
    );

    renderDetail();

    expect(
      await screen.findByText(
        "A retail enterprise wants a forecasting platform.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("ai-ml")).toBeInTheDocument();
    expect(screen.getByText("Confirm data quality.")).toBeInTheDocument();
    expect(screen.getByText("You have 3 analyses left.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeEnabled();
  });

  it("offers Generate with a countdown for a pending intake (owner)", async () => {
    getMock.mockResolvedValue(intake({ analysisStatus: "pending" }));

    renderDetail();

    expect(await screen.findByText("No analysis yet")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Generate analysis" }),
    ).toBeEnabled();
    expect(screen.getByText("You have 3 analyses left.")).toBeInTheDocument();
  });

  it("shows a failed analysis with Retry, and re-running flips to Analyzing", async () => {
    getMock
      .mockResolvedValueOnce(
        intake({
          analysisStatus: "failed",
          analysisError: "OpenAI request failed",
          analysisRunCount: 1,
        }),
      )
      // any subsequent fetch (the post-retry poll) returns "processing"
      .mockResolvedValue(intake({ analysisStatus: "processing", analysisRunCount: 2 }));
    analyzeMock.mockResolvedValueOnce(
      intake({ analysisStatus: "processing", analysisRunCount: 2 }),
    );

    const user = userEvent.setup();
    renderDetail();

    expect(await screen.findByText("OpenAI request failed")).toBeInTheDocument();
    expect(screen.getByText("You have 2 analyses left.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/Analyzing…/)).toBeInTheDocument();
    expect(analyzeMock).toHaveBeenCalledWith("i1");
  });

  it("disables re-analysis once the per-intake budget is spent", async () => {
    getMock.mockResolvedValue(
      intake({
        analysisStatus: "completed",
        analyzedAt: "2026-05-28T01:00:00.000Z",
        summary: "Done.",
        tags: ["t"],
        riskChecklist: ["r"],
        analysisRunCount: 3,
      }),
    );

    renderDetail();

    expect(await screen.findByText("Done.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeDisabled();
    expect(
      screen.getByText("No re-analyses left for this intake."),
    ).toBeInTheDocument();
  });

  it("shows a live spinner while analysis is processing", async () => {
    getMock.mockResolvedValue(intake({ analysisStatus: "processing" }));

    renderDetail();

    expect(await screen.findByText(/Analyzing…/)).toBeInTheDocument();
  });

  it("is read-only for non-owners (no Generate action)", async () => {
    currentUser = { id: "u2", email: "dana@example.com", name: "Dana" };
    getMock.mockResolvedValue(intake({ analysisStatus: "pending" })); // owned by u1

    renderDetail();

    expect(
      await screen.findByText(
        "Only the person who submitted this intake can run its analysis.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Generate analysis" }),
    ).toBeNull();
  });
});
