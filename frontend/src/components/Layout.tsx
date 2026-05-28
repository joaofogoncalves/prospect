import { Link } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { ChevronDown, KeyRound, LogOut, Moon, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const isDark = theme === "dark";

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold">
            Project Intake
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <span className="hidden max-w-[16ch] truncate sm:inline">
                {user?.name ?? user?.email}
              </span>
              <span className="sm:hidden">Account</span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={toggleTheme}>
                {isDark ? <Sun /> : <Moon />}
                {isDark ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
                <KeyRound />
                Change password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
