import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "@/lib/api";

// This jsdom setup has no working localStorage, and api() calls getToken();
// stub both localStorage and fetch so we can inspect the outgoing request.
const store = new Map<string, string>();

function mockFetch(status = 200, body: unknown = {}) {
  const f = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  });
  vi.stubGlobal("fetch", f);
  return f;
}

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("api() request shaping", () => {
  it("does NOT send Content-Type for a bodyless request (avoids Fastify 400)", async () => {
    const f = mockFetch(200, { ok: true });
    await api("/api/intakes/abc/analyze", { method: "POST" });

    const init = f.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("sends Content-Type + serialized JSON when a body is provided", async () => {
    const f = mockFetch(201, {});
    await api("/api/intakes", { method: "POST", body: { name: "x" } });

    const init = f.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "x" }));
  });

  it("attaches the bearer token when present", async () => {
    store.set("intake_token", "tok-123");
    const f = mockFetch(200, []);
    await api("/api/intakes");

    const init = f.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
  });
});
