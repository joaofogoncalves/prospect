import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { intakesApi, type Intake } from "@/lib/api";
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{value}</dd>
    </div>
  );
}

export default function IntakeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [intake, setIntake] = useState<Intake | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const autoTriggered = useRef<string | null>(null);

  const loadIntake = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setIntake(await intakesApi.get(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load intake");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const runAnalyze = useCallback(async () => {
    if (!id) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      setIntake(await intakesApi.analyze(id));
    } catch (err) {
      setAnalyzeError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }, [id]);

  useEffect(() => {
    loadIntake();
  }, [loadIntake]);

  // Auto-run analysis once when an unanalyzed intake first loads.
  useEffect(() => {
    if (
      intake &&
      !intake.analyzedAt &&
      !analyzing &&
      autoTriggered.current !== intake.id
    ) {
      autoTriggered.current = intake.id;
      runAnalyze();
    }
  }, [intake, analyzing, runAnalyze]);

  return (
    <Layout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          ← Back to intakes
        </Button>
      </div>

      {loading && <LoadingState rows={2} />}

      {!loading && error && <ErrorState message={error} onRetry={loadIntake} />}

      {!loading && !error && intake && (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{intake.title}</CardTitle>
              <CardDescription>
                Created {new Date(intake.createdAt).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <dl className="grid gap-4 sm:grid-cols-3">
                <Field label="Industry" value={intake.industry} />
                <Field label="Budget range" value={intake.budgetRange} />
                <Field label="Timeline" value={intake.timeline} />
              </dl>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Description
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm">
                  {intake.description}
                </dd>
              </div>
            </CardContent>
          </Card>

          <AiAnalysis
            intake={intake}
            analyzing={analyzing}
            error={analyzeError}
            onRun={runAnalyze}
          />
        </div>
      )}
    </Layout>
  );
}

function AiAnalysis({
  intake,
  analyzing,
  error,
  onRun,
}: {
  intake: Intake;
  analyzing: boolean;
  error: string | null;
  onRun: () => void;
}) {
  const hasAnalysis = Boolean(intake.analyzedAt && intake.summary);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>AI analysis</CardTitle>
            {intake.analyzedAt && (
              <CardDescription className="mt-1">
                Generated {new Date(intake.analyzedAt).toLocaleString()}
              </CardDescription>
            )}
          </div>
          {hasAnalysis && !analyzing && (
            <Button variant="outline" size="sm" onClick={onRun}>
              Regenerate
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {analyzing && <LoadingState rows={2} />}

        {!analyzing && error && <ErrorState message={error} onRetry={onRun} />}

        {!analyzing && !error && !hasAnalysis && (
          <EmptyState
            title="No analysis yet"
            description="Generate a summary, tags, and a risk checklist for this intake."
            action={<Button onClick={onRun}>Generate analysis</Button>}
          />
        )}

        {!analyzing && !error && hasAnalysis && (
          <div className="grid gap-6">
            <div>
              <h3 className="mb-1 text-sm font-medium">Summary</h3>
              <p className="text-sm text-muted-foreground">{intake.summary}</p>
            </div>

            {intake.tags && intake.tags.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {intake.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {intake.riskChecklist && intake.riskChecklist.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium">Risk checklist</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {intake.riskChecklist.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
