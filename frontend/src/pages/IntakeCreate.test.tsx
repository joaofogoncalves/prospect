import { describe, it, expect, vi, beforeEach } from "vitest";
import { Route } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter, deferred } from "@/test/utils";
import IntakeCreate from "@/pages/IntakeCreate";

// Intercept the api boundary. auth.tsx (via Layout) imports `api`/`getToken`,
// and IntakeCreate imports `intakesApi` — all from "@/lib/api".
const createMock = vi.fn();
const analyzeMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  getToken: () => null,
  setToken: () => {},
  intakesApi: {
    create: (...args: unknown[]) => createMock(...args),
    analyze: (...args: unknown[]) => analyzeMock(...args),
    list: vi.fn(),
    get: vi.fn(),
  },
}));

beforeEach(() => {
  createMock.mockReset();
  analyzeMock.mockReset();
});

const intake = (over: Record<string, unknown> = {}) => ({
  id: "i1",
  title: "Forecasting platform",
  description: "d",
  budgetRange: "$2M",
  timeline: "9 months",
  industry: "Retail",
  createdAt: "2026-05-28T00:00:00.000Z",
  updatedAt: "2026-05-28T00:00:00.000Z",
  summary: null,
  tags: null,
  riskChecklist: null,
  analyzedAt: null,
  ...over,
});

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Title"), "Forecasting platform");
  await user.type(screen.getByLabelText("Description"), "Build a platform");
  await user.type(screen.getByLabelText("Budget range"), "$2M – $4M");
  await user.type(screen.getByLabelText("Timeline"), "9 months");
  await user.type(screen.getByLabelText("Industry"), "Retail");
}

function render() {
  return renderWithRouter(<IntakeCreate />, {
    path: "/intakes/new",
    extraRoutes: <Route path="/intakes/:id" element={<div>Detail ✓</div>} />,
  });
}

describe("IntakeCreate — analyze-on-create state transitions", () => {
  it("form → working → analysis error (intake saved) → retry → detail", async () => {
    const user = userEvent.setup();
    render();
    await fillForm(user);

    // Hold the create request open to observe the working state.
    const pending = deferred<ReturnType<typeof intake>>();
    createMock.mockReturnValueOnce(pending.promise);
    await user.click(screen.getByRole("button", { name: "Create intake" }));

    // working: shows the creating state.
    expect(await screen.findByText("Creating intake…")).toBeInTheDocument();

    // Intake persisted, but analysis failed → recoverable error state.
    pending.resolve(
      intake({ analyzedAt: null, analysisError: "OpenAI request failed" }),
    );
    expect(
      await screen.findByText("Intake saved — analysis failed"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("OpenAI request failed");

    // Retry analysis succeeds → navigate to the detail view.
    analyzeMock.mockResolvedValueOnce(intake({ analyzedAt: "2026-05-28T01:00:00Z" }));
    await user.click(screen.getByRole("button", { name: "Retry analysis" }));
    expect(await screen.findByText("Detail ✓")).toBeInTheDocument();
    expect(analyzeMock).toHaveBeenCalledWith("i1");
  });

  it("create succeeds and analysis succeeds → navigates straight to detail", async () => {
    const user = userEvent.setup();
    render();
    await fillForm(user);

    createMock.mockResolvedValueOnce(intake({ analyzedAt: "2026-05-28T01:00:00Z" }));
    await user.click(screen.getByRole("button", { name: "Create intake" }));

    expect(await screen.findByText("Detail ✓")).toBeInTheDocument();
  });

  it("creation failure keeps the form and entered values, then recovers", async () => {
    const user = userEvent.setup();
    render();
    await fillForm(user);

    // Creation itself fails (e.g. network/validation) — no data should be lost.
    createMock.mockRejectedValueOnce(new Error("Failed to create intake"));
    await user.click(screen.getByRole("button", { name: "Create intake" }));

    // Error shown, form still present with the values intact, button usable.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to create intake",
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Forecasting platform");
    const retry = screen.getByRole("button", { name: "Try again" });
    await waitFor(() => expect(retry).toBeEnabled());

    // Resubmit; this time creation + analysis succeed → detail.
    createMock.mockResolvedValueOnce(intake({ analyzedAt: "2026-05-28T01:00:00Z" }));
    await user.click(retry);
    expect(await screen.findByText("Detail ✓")).toBeInTheDocument();
  });
});
