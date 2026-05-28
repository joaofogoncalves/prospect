import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";

// Mock the network and auth boundaries so we can assert the state machine and
// the "log out on success" behaviour without a backend.
const changePasswordMock = vi.fn();
vi.mock("@/lib/api", () => ({
  authApi: { changePassword: (...args: unknown[]) => changePasswordMock(...args) },
}));
const logoutMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ logout: logoutMock }),
}));

beforeEach(() => {
  changePasswordMock.mockReset();
  logoutMock.mockReset();
});

function renderDialog() {
  return render(
    <MemoryRouter>
      <ChangePasswordDialog open onOpenChange={() => {}} />
    </MemoryRouter>,
  );
}

describe("ChangePasswordDialog", () => {
  it("validates the confirmation before calling the API", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Current password"), "current-pw");
    await user.type(screen.getByLabelText("New password"), "new-password-1");
    await user.type(screen.getByLabelText("Confirm new password"), "different-pw-2");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "New passwords do not match",
    );
    expect(changePasswordMock).not.toHaveBeenCalled();
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it("shows an error, recovers, then logs out on success", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Current password"), "wrong-pw");
    await user.type(screen.getByLabelText("New password"), "new-password-1");
    await user.type(screen.getByLabelText("Confirm new password"), "new-password-1");

    // First attempt: wrong current password -> error, no logout.
    changePasswordMock.mockRejectedValueOnce(
      new Error("Current password is incorrect"),
    );
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Current password is incorrect",
    );
    expect(logoutMock).not.toHaveBeenCalled();

    // Recovery: correct the current password, resubmit, succeed (204 -> null).
    changePasswordMock.mockResolvedValueOnce(null);
    await user.clear(screen.getByLabelText("Current password"));
    await user.type(screen.getByLabelText("Current password"), "right-pw");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() => expect(logoutMock).toHaveBeenCalledTimes(1));
    expect(changePasswordMock).toHaveBeenLastCalledWith("right-pw", "new-password-1");
  });
});
