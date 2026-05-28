import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Project Intake</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {user?.name ?? user?.email}
          </span>
          <Button variant="outline" size="sm" onClick={logout}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-muted-foreground">Nothing here yet.</p>
      </main>
    </div>
  );
}
