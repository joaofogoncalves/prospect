import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { ChevronDown, KeyRound, LogOut, Moon, Sun, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/LogoMark";
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
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const isDark = theme === "dark";

  return (
    <div className="min-h-svh bg-background">
      <header className="pi-no-print border-b bg-primary/[0.03] dark:bg-primary/[0.05]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight"
            >
              <LogoMark size={22} className="text-primary" />
              <span>Prospect</span>
            </Link>
            {/* The wordmark links home (the list); this is the only extra nav.
                The active link uses the sanctioned accent pill
                (bg-primary/10 text-primary — same as the section count badges)
                so the current view reads clearly (styleguide §2, §4). */}
            <nav className="flex items-center gap-1 text-sm">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-2.5 py-1.5 font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary dark:bg-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                Dashboard
              </NavLink>
            </nav>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <span className="hidden max-w-[16ch] truncate sm:inline">
                {user?.name ?? user?.email}
              </span>
              <span className="sm:hidden">Account</span>
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <UserRound />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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

      <main className="pi-page-enter mx-auto max-w-4xl px-6 py-8">{children}</main>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
