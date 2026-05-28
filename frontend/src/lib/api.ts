const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const TOKEN_KEY = "intake_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

// Thin fetch wrapper that attaches the bearer token and parses JSON.
// Throws an Error with the server's message on non-2xx responses.
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const token = getToken();
  const hasBody = body !== undefined;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      // Only advertise JSON when we actually send a body — otherwise Fastify
      // rejects the empty body of a bodyless POST (e.g. /analyze) with a 400.
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? (data as { error: string }).error
        : null) ?? `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data as T;
}

// --- Intakes ---

// The creator attached to every intake. Intakes are readable by anyone signed
// in; ownership (who may run analysis) is decided by comparing `userId` to the
// current user's id.
export type IntakeCreator = {
  id: string;
  name: string | null;
  email: string;
};

// Analysis lifecycle (see backend Intake.analysisStatus):
//  pending    — never analyzed, nothing running (owner can Generate)
//  processing — a background job is running; the client polls until it settles
//  completed  — summary/tags/riskChecklist/analyzedAt populated
//  failed     — see `analysisError`
export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";

export type Intake = {
  id: string;
  title: string;
  description: string;
  budgetRange: string;
  timeline: string;
  industry: string;
  createdAt: string;
  updatedAt: string;
  summary: string | null;
  tags: string[] | null;
  riskChecklist: string[] | null;
  analyzedAt: string | null;
  analysisStatus: AnalysisStatus;
  analysisError: string | null;
  // User-initiated re-analyze runs spent on this intake (drives the countdown).
  analysisRunCount: number;
  userId: string;
  user: IntakeCreator;
};

export type IntakeInput = {
  title: string;
  description: string;
  budgetRange: string;
  timeline: string;
  industry: string;
};

// Max user-initiated (re-)analyses per intake. Kept in sync with MAX_REANALYSIS
// in backend/src/routes/intakes.ts, which enforces it (the server is
// authoritative; this constant only drives the "N analyses left" UI).
export const MAX_REANALYSIS = 3;

// --- Dashboard stats ---
// Aggregate, team-wide counts for the dashboard. Mirrors `StatsResponse` in
// backend/src/routes/intakes.ts (GET /api/intakes/stats) — keep the two in sync.
export type IntakeStats = {
  totals: {
    intakes: number;
    analyzed: number;
    notAnalyzed: number;
    contributors: number;
  };
  // Analysis lifecycle counts (pending | processing | completed | failed).
  byStatus: { status: string; count: number }[];
  byTag: { tag: string; count: number }[];
  byIndustry: { industry: string; count: number }[];
  leaderboard: {
    userId: string;
    name: string | null;
    email: string;
    count: number;
    analyzedCount: number;
  }[];
  // Intakes created per calendar day ("YYYY-MM-DD"), oldest first.
  overTime: { date: string; count: number }[];
};

export const intakesApi = {
  list: () => api<Intake[]>("/api/intakes"),
  get: (id: string) => api<Intake>(`/api/intakes/${id}`),
  stats: () => api<IntakeStats>("/api/intakes/stats"),
  // Both create and analyze return immediately with the intake in "processing";
  // analysis runs in the background and the caller polls `get` for the result.
  create: (input: IntakeInput) =>
    api<Intake>("/api/intakes", { method: "POST", body: input }),
  analyze: (id: string) =>
    api<Intake>(`/api/intakes/${id}/analyze`, { method: "POST" }),
};

// --- Auth (account management) ---

export const authApi = {
  // Resolves on 204; throws with the server message otherwise.
  changePassword: (currentPassword: string, newPassword: string) =>
    api<null>("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    }),
};
