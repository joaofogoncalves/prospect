import { UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
}

// A read-only view of the signed-in account — handy for confirming which email
// you're logged in as before signing out. Data comes from the auth session
// (GET /api/auth/me), no extra fetch needed.
export default function Profile() {
  const { user } = useAuth();

  const fields: { label: string; value: string }[] = [
    { label: "Name", value: user?.name?.trim() || "—" },
    { label: "Email", value: user?.email ?? "—" },
    { label: "Member since", value: user ? formatDate(user.createdAt) : "—" },
  ];

  return (
    <Layout>
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20">
            <UserRound className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold">Profile</h1>
            <p className="text-sm text-muted-foreground">Your account details.</p>
          </div>
        </div>

        <Card>
          <CardContent>
            <dl className="divide-y divide-border">
              {fields.map((f) => (
                <div
                  key={f.label}
                  className="grid grid-cols-3 gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <dt className="text-sm text-muted-foreground">{f.label}</dt>
                  <dd className="col-span-2 text-sm break-words">{f.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
