import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/lib/theme";
import Profile from "@/pages/Profile";

let currentUser: {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
} | null = {
  id: "u1",
  email: "you@example.com",
  name: "You Tester",
  createdAt: "2026-01-18T11:05:00.000Z",
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

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={["/profile"]}>
      <ThemeProvider>
        <Routes>
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("Profile", () => {
  it("shows the account's name, email, and join date", () => {
    currentUser = {
      id: "u1",
      email: "you@example.com",
      name: "You Tester",
      createdAt: "2026-01-18T11:05:00.000Z",
    };

    const { container } = renderProfile();

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    // Scope to the details list — the header account menu also renders the name.
    const dl = within(container.querySelector("dl")!);
    expect(dl.getByText("You Tester")).toBeInTheDocument();
    expect(dl.getByText("you@example.com")).toBeInTheDocument();
    // The ISO timestamp is rendered as a human date (locale-formatted).
    expect(dl.getByText(/January 18, 2026/)).toBeInTheDocument();
  });

  it("falls back to an em dash when the user has no name", () => {
    currentUser = {
      id: "u2",
      email: "noname@example.com",
      name: null,
      createdAt: "2025-07-02T15:45:00.000Z",
    };

    const { container } = renderProfile();

    const dl = within(container.querySelector("dl")!);
    expect(dl.getByText("noname@example.com")).toBeInTheDocument();
    expect(dl.getByText("—")).toBeInTheDocument();
  });
});
