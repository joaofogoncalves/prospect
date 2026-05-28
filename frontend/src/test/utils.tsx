import type { ReactElement, ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";

/**
 * A small Promise you resolve/reject by hand — handy for asserting an
 * intermediate UI state (e.g. "submitting") before the request settles.
 *
 *   const d = deferred<void>();
 *   apiMock.mockReturnValueOnce(d.promise);
 *   // ...assert spinner is showing...
 *   d.resolve();
 */
export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Render `ui` at `path`, wrapped in the real Theme/Auth providers and a router.
 * Pass `extraRoutes` to give navigation targets to assert against — e.g. a
 * marker element at "/" so a successful login has somewhere to land.
 */
export function renderWithRouter(
  ui: ReactElement,
  {
    path = "/login",
    extraRoutes,
  }: { path?: string; extraRoutes?: ReactNode } = {},
): RenderResult {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path={path} element={ui} />
            {extraRoutes}
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}
