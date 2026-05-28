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

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
};

export type IntakeInput = {
  title: string;
  description: string;
  budgetRange: string;
  timeline: string;
  industry: string;
};

export const intakesApi = {
  list: () => api<Intake[]>("/api/intakes"),
  get: (id: string) => api<Intake>(`/api/intakes/${id}`),
  create: (input: IntakeInput) =>
    api<Intake>("/api/intakes", { method: "POST", body: input }),
  analyze: (id: string) =>
    api<Intake>(`/api/intakes/${id}/analyze`, { method: "POST" }),
};
