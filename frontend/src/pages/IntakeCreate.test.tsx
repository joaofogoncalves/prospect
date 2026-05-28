import { describe, it, expect, vi, beforeEach } from "vitest";
import { Route } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter, deferred } from "@/test/utils";
import IntakeCreate from "@/pages/IntakeCreate";

// Intercept the api boundary. auth.tsx (via Layout) imports `api`/`getToken`,
// and IntakeCreate imports `intakesApi` — all from "@/lib/api".
const createMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: vi.fn(),
  getToken: () => null,
  setToken: () => {},
  MAX_REANALYSIS: 3,
  intakesApi: {
    create: (...args: unknown[]) => createMock(...args),
    analyze: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
  },
}));

beforeEach(() => {
  createMock.mockReset();
});

// Analysis now runs as a background job, so create returns immediately with the
// intake in "processing"; IntakeCreate just navigates to the detail view.
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
  analysisStatus: "processing",
  analysisError: null,
  analysisRunCount: 0,
  userId: "u1",
  user: { id: "u1", name: null, email: "a@b.c" },
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

describe("IntakeCreate — submit then hand off to detail", () => {
  it("create succeeds → navigates straight to the detail view", async () => {
    const user = userEvent.setup();
    render();
    await fillForm(user);

    createMock.mockResolvedValueOnce(intake());
    await user.click(screen.getByRole("button", { name: "Create intake" }));

    expect(await screen.findByText("Detail ✓")).toBeInTheDocument();
  });

  it("shows a submitting state while the create request is in flight", async () => {
    const user = userEvent.setup();
    render();
    await fillForm(user);

    // Hold the create request open to observe the submitting state.
    const pending = deferred<ReturnType<typeof intake>>();
    createMock.mockReturnValueOnce(pending.promise);
    await user.click(screen.getByRole("button", { name: "Create intake" }));

    const submitting = screen.getByRole("button", { name: "Creating…" });
    expect(submitting).toBeDisabled();

    pending.resolve(intake());
    expect(await screen.findByText("Detail ✓")).toBeInTheDocument();
  });

  it("creation failure keeps the form and entered values, then recovers", async () => {
    const user = userEvent.setup();
    render();
    await fillForm(user);

    // Creation itself fails (e.g. network/validation) — no data should be lost.
    createMock.mockRejectedValueOnce(new Error("Failed to create intake"));
    await user.click(screen.getByRole("button", { name: "Create intake" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to create intake",
    );
    expect(screen.getByLabelText("Title")).toHaveValue("Forecasting platform");
    const retry = screen.getByRole("button", { name: "Try again" });
    await waitFor(() => expect(retry).toBeEnabled());

    // Resubmit; this time creation succeeds → detail.
    createMock.mockResolvedValueOnce(intake());
    await user.click(retry);
    expect(await screen.findByText("Detail ✓")).toBeInTheDocument();
  });
});
