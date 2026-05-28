import { describe, it, expect, vi, beforeEach } from "vitest";
import { Route } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithRouter, deferred } from "@/test/utils";
import { AuthForm } from "@/components/AuthForm";

// Control the network at the api boundary. auth.tsx imports `api` from
// "./api", which resolves to the same module as "@/lib/api", so this mock
// intercepts the real login/register calls.
const apiMock = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...args: unknown[]) => apiMock(...args),
  getToken: () => null,
  setToken: () => {},
}));

beforeEach(() => {
  apiMock.mockReset();
});

describe("AuthForm — login state transitions", () => {
  it("goes idle → submitting → error, then recovers → dashboard", async () => {
    const user = userEvent.setup();
    renderWithRouter(<AuthForm mode="login" />, {
      path: "/login",
      extraRoutes: <Route path="/" element={<div>Dashboard ✓</div>} />,
    });

    // idle: submit button enabled, no error shown.
    const submit = () => screen.getByRole("button", { name: /sign in|please wait/i });
    expect(submit()).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "you@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");

    // First attempt: keep the request pending so we can observe "submitting".
    const pending = deferred<never>();
    apiMock.mockReturnValueOnce(pending.promise);
    await user.click(submit());

    // submitting: button disabled and shows the busy label.
    expect(await screen.findByRole("button", { name: "Please wait…" })).toBeDisabled();

    // Reject the request -> error state.
    pending.reject(new Error("Invalid email or password"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password",
    );
    // recovered to an interactive idle state (button usable again).
    await waitFor(() => expect(submit()).toBeEnabled());

    // Recovery: correct the password and resubmit; this time it succeeds.
    apiMock.mockResolvedValueOnce({
      token: "test-token",
      user: { id: "u1", email: "you@example.com", name: null },
    });
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(submit());

    // success transition: navigated to "/", error cleared.
    expect(await screen.findByText("Dashboard ✓")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("navigates from login to register via the alt link", async () => {
    const user = userEvent.setup();
    renderWithRouter(<AuthForm mode="login" />, {
      path: "/login",
      extraRoutes: (
        <Route path="/register" element={<AuthForm mode="register" />} />
      ),
    });

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Create one" }));

    expect(screen.getByText("Create your account")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });
});
