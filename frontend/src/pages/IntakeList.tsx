import { Link, useNavigate } from "react-router-dom";
import { intakesApi } from "@/lib/api";
import { useQuery } from "@/lib/useQuery";
import { Layout } from "@/components/Layout";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function IntakeList() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useQuery(() => intakesApi.list());

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Intakes</h1>
          <p className="text-sm text-muted-foreground">
            Bond project requests, newest first.
          </p>
        </div>
        <Button onClick={() => navigate("/intakes/new")}>New intake</Button>
      </div>

      {loading && <LoadingState rows={4} />}

      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && data.length === 0 && (
        <EmptyState
          title="No intakes yet"
          description="Create your first bond project intake to get started."
          action={
            <Button onClick={() => navigate("/intakes/new")}>
              Create intake
            </Button>
          }
        />
      )}

      {!loading && !error && data && data.length > 0 && (
        <div className="grid gap-4">
          {data.map((intake) => (
            <Link key={intake.id} to={`/intakes/${intake.id}`}>
              <Card className="transition-colors hover:border-foreground/30">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{intake.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {intake.industry} · {intake.budgetRange} ·{" "}
                        {intake.timeline}
                      </CardDescription>
                    </div>
                    {intake.analyzedAt ? (
                      <Badge variant="secondary">Analyzed</Badge>
                    ) : (
                      <Badge variant="outline">Not analyzed</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {intake.summary ?? intake.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  );
}
